import sys
import os

# Add the application directory to the Python path
sys.path.insert(0, os.path.dirname(__file__))

# Phusion Passenger requires the callable to be named 'application'
from app import app as application
