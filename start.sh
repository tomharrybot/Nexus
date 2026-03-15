#!/bin/bash
export PYTHONPATH=/home/runner/workspace/.pythonlibs/lib/python3.11/site-packages:$PYTHONPATH
export PATH=/home/runner/workspace/.pythonlibs/bin:$PATH
exec python3.11 app.py
