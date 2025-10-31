# Setup Guide for macOS

## The SSL Certificate Issue

You're seeing SSL errors because Python 3.13 on macOS doesn't have SSL certificates installed by default.

## Quick Setup (Recommended)

Run the automated setup script:

```bash
cd /Users/erik/Projects/apps/AnkiChat
./setup.sh
```

This will:
- Fix SSL certificates
- Create a virtual environment
- Install all dependencies

## Manual Setup (if script fails)

### Step 1: Fix SSL Certificates

Run Python's certificate installer:

```bash
# For Python 3.13
/Applications/Python\ 3.13/Install\ Certificates.command

# Or if you have Python 3.12
/Applications/Python\ 3.12/Install\ Certificates.command
```

**Alternative if the above doesn't work:**

```bash
cd /Users/erik/Projects/apps/AnkiChat
source venv/bin/activate
pip install --upgrade certifi
python3 -c "import certifi; print(certifi.where())"
export SSL_CERT_FILE=$(python3 -c "import certifi; print(certifi.where())")
```

### Step 2: Create Virtual Environment

```bash
cd /Users/erik/Projects/apps/AnkiChat
python3 -m venv venv
source venv/bin/activate
```

### Step 3: Install Dependencies

```bash
# Core dependencies
pip install gitpython pydantic httpx pyyaml typer rich

# Optional (for offline mode and testing)
pip install genanki pytest respx
```

## Using the Virtual Environment

### Activate (every time you use the tool)

```bash
cd /Users/erik/Projects/apps/AnkiChat
source venv/bin/activate
```

You'll see `(venv)` in your terminal prompt.

### Run AnkiTex

```bash
# Test with dry-run
python -m anki_tex.cli process --repo . --dry-run

# Or use shorthand
python -m anki_tex.cli --help
```

### Deactivate (when done)

```bash
deactivate
```

## Testing the Setup

Once everything is installed, test it:

```bash
source venv/bin/activate
python -c "import anki_tex; print('✅ AnkiTex imported successfully!')"
python -m anki_tex.cli version
```

## Troubleshooting

### Issue: "command not found: source"

You're probably not in bash/zsh. Try:
```bash
. venv/bin/activate
```

### Issue: Still getting SSL errors

Try using a trusted host temporarily:
```bash
pip install --trusted-host pypi.org --trusted-host files.pythonhosted.org gitpython pydantic httpx pyyaml typer rich
```

### Issue: Permission errors

Don't use `sudo`. Virtual environments should work without root access.

### Issue: Python version too old

AnkiTex requires Python 3.11+. Check your version:
```bash
python3 --version
```

If it's older, install a newer Python from [python.org](https://www.python.org/downloads/).

## Alternative: Use System Python (not recommended)

If virtual environments don't work, you can install globally:

```bash
pip3 install --user gitpython pydantic httpx pyyaml typer rich genanki
```

But this can cause conflicts with other Python projects.

## Next Steps

After setup is complete, see:
- `QUICKSTART.md` - First run guide
- `README.md` - Full documentation

