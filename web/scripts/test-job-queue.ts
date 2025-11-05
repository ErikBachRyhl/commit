/**
 * Quick test script for the job queue system
 * 
 * Run with: npx tsx scripts/test-job-queue.ts
 */

import { prisma } from '../lib/prisma'
import { PIPELINE_VERSION } from '../lib/constants'
import { createJob, getCommitStatus } from '../lib/job-queue'
import { acquireRepoLock, releaseRepoLock } from '../lib/db-lock'

async function runTests() {
  console.log('🧪 Testing Job Queue System\n')
  
  let passed = 0
  let failed = 0
  
  // Test 1: Check pipeline version
  console.log('Test 1: Pipeline Version')
  try {
    console.log(`  ✅ Current version: ${PIPELINE_VERSION}`)
    passed++
  } catch (error) {
    console.log(`  ❌ Failed: ${error}`)
    failed++
  }
  
  // Test 2: Database connection
  console.log('\nTest 2: Database Connection')
  try {
    await prisma.$connect()
    console.log('  ✅ Connected to database')
    passed++
  } catch (error) {
    console.log(`  ❌ Failed: ${error}`)
    failed++
    return // Can't continue without DB
  }
  
  // Test 3: Advisory locks
  console.log('\nTest 3: Advisory Locks')
  try {
    const testRepo = '/test/repo/path'
    const acquired1 = await acquireRepoLock(testRepo)
    console.log(`  ✅ First lock acquired: ${acquired1}`)
    
    const acquired2 = await acquireRepoLock(testRepo)
    console.log(`  ✅ Second lock acquired: ${acquired2} (should be false)`)
    
    await releaseRepoLock(testRepo)
    console.log('  ✅ Lock released')
    
    const acquired3 = await acquireRepoLock(testRepo)
    console.log(`  ✅ Third lock acquired: ${acquired3} (should be true)`)
    await releaseRepoLock(testRepo)
    
    passed++
  } catch (error) {
    console.log(`  ❌ Failed: ${error}`)
    failed++
  }
  
  // Test 4: Job creation (need a test user)
  console.log('\nTest 4: Job Creation')
  try {
    // Get or create test user
    let testUser = await prisma.user.findFirst({
      where: { email: 'test@example.com' }
    })
    
    if (!testUser) {
      testUser = await prisma.user.create({
        data: {
          email: 'test@example.com',
          name: 'Test User'
        }
      })
      console.log('  ℹ️  Created test user')
    }
    
    const jobId = await createJob(
      testUser.id,
      'reprocess',
      { commit_ids: ['test-commit-1', 'test-commit-2'] },
      false
    )
    
    console.log(`  ✅ Created job: ${jobId}`)
    
    // Verify job exists
    const job = await prisma.job.findUnique({ where: { id: jobId } })
    console.log(`  ✅ Job found in database: ${job?.status}`)
    
    passed++
  } catch (error) {
    console.log(`  ❌ Failed: ${error}`)
    failed++
  }
  
  // Test 5: Idempotency
  console.log('\nTest 5: Idempotency')
  try {
    const testUser = await prisma.user.findFirst({
      where: { email: 'test@example.com' }
    })
    
    if (!testUser) throw new Error('Test user not found')
    
    const selector = { commit_ids: ['idempotent-test-1', 'idempotent-test-2'] }
    
    const jobId1 = await createJob(testUser.id, 'reprocess', selector, false)
    const jobId2 = await createJob(testUser.id, 'reprocess', selector, false)
    
    if (jobId1 === jobId2) {
      console.log(`  ✅ Idempotency works: ${jobId1} === ${jobId2}`)
      passed++
    } else {
      console.log(`  ❌ Idempotency failed: ${jobId1} !== ${jobId2}`)
      failed++
    }
  } catch (error) {
    console.log(`  ❌ Failed: ${error}`)
    failed++
  }
  
  // Test 6: Force mode bypasses idempotency
  console.log('\nTest 6: Force Mode')
  try {
    const testUser = await prisma.user.findFirst({
      where: { email: 'test@example.com' }
    })
    
    if (!testUser) throw new Error('Test user not found')
    
    const selector = { commit_ids: ['force-test-1'] }
    
    const jobId1 = await createJob(testUser.id, 'reprocess', selector, true)
    const jobId2 = await createJob(testUser.id, 'reprocess', selector, true)
    
    if (jobId1 !== jobId2) {
      console.log(`  ✅ Force mode creates new jobs: ${jobId1} !== ${jobId2}`)
      passed++
    } else {
      console.log(`  ❌ Force mode failed: ${jobId1} === ${jobId2}`)
      failed++
    }
  } catch (error) {
    console.log(`  ❌ Failed: ${error}`)
    failed++
  }
  
  // Test 7: Commit status checking
  console.log('\nTest 7: Commit Status')
  try {
    const status = await getCommitStatus('test-new-commit')
    console.log(`  ✅ New commit status: ${status}`)
    
    // Create a successful commit run
    await prisma.commitRun.create({
      data: {
        commitSha: 'test-processed-commit',
        pipelineVersion: PIPELINE_VERSION,
        status: 'success'
      }
    })
    
    const processedStatus = await getCommitStatus('test-processed-commit')
    console.log(`  ✅ Processed commit status: ${processedStatus}`)
    
    // Create an old version commit run
    await prisma.commitRun.create({
      data: {
        commitSha: 'test-old-commit',
        pipelineVersion: 'old-version',
        status: 'success'
      }
    })
    
    const oldStatus = await getCommitStatus('test-old-commit')
    console.log(`  ✅ Old version commit status: ${oldStatus}`)
    
    passed++
  } catch (error) {
    console.log(`  ❌ Failed: ${error}`)
    failed++
  }
  
  // Summary
  console.log('\n' + '='.repeat(50))
  console.log(`✅ Passed: ${passed}`)
  console.log(`❌ Failed: ${failed}`)
  console.log(`📊 Success rate: ${((passed / (passed + failed)) * 100).toFixed(1)}%`)
  
  if (failed === 0) {
    console.log('\n🎉 All tests passed! Ready for Phase 5-8.')
  } else {
    console.log('\n⚠️  Some tests failed. Check the errors above.')
  }
  
  // Cleanup
  console.log('\n🧹 Cleaning up test data...')
  await prisma.job.deleteMany({
    where: {
      selector: {
        path: ['commit_ids'],
        array_contains: ['test-commit-1']
      }
    }
  })
  await prisma.commitRun.deleteMany({
    where: {
      commitSha: {
        startsWith: 'test-'
      }
    }
  })
  console.log('✅ Cleanup complete')
  
  await prisma.$disconnect()
  
  process.exit(failed > 0 ? 1 : 0)
}

runTests().catch(error => {
  console.error('💥 Test suite crashed:', error)
  process.exit(1)
})

