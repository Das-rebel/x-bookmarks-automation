#!/usr/bin/env python3
"""Debug OpenAI client configuration"""

import os
import sys
import json
import logging
import platform
import ssl
import socket
import urllib3
from pprint import pprint
from dotenv import load_dotenv

# Enable verbose logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger()

# Load environment variables
load_dotenv(override=True)

def print_section(title):
    """Print a section header"""
    print("\n" + "="*80)
    print(f" {title}".ljust(80, '='))
    print("="*80)

def check_environment():
    """Check Python environment"""
    print_section("ENVIRONMENT INFORMATION")
    print(f"Python: {sys.executable} ({platform.python_version()})")
    print(f"Platform: {platform.platform()}")
    print(f"OpenSSL: {ssl.OPENSSL_VERSION}")
    print(f"urllib3: {urllib3.__version__}")
    
    # Check environment variables
    print("\nEnvironment Variables:")
    env_vars = [
        'OPENAI_API_KEY', 'HTTP_PROXY', 'HTTPS_PROXY', 'NO_PROXY',
        'http_proxy', 'https_proxy', 'no_proxy', 'REQUESTS_CA_BUNDLE',
        'CURL_CA_BUNDLE', 'SSL_CERT_FILE', 'SSL_CERT_DIR'
    ]
    for var in env_vars:
        value = os.getenv(var)
        if value:
            print(f"  {var}: {value[:10]}...{value[-5:] if len(value) > 20 else value}")
    
    # Check if we can import openai
    try:
        import openai
        print(f"\nOpenAI package: {openai.__version__}")
        print(f"OpenAI API base: {getattr(openai, '_api_base', 'default')}")
        return True
    except ImportError as e:
        print(f"\n❌ OpenAI package not installed: {e}")
        return False
    except Exception as e:
        print(f"\n❌ Error importing OpenAI: {e}")
        return False

def check_network_connectivity():
    """Check network connectivity to OpenAI"""
    print_section("NETWORK CONNECTIVITY")
    
    # Test DNS resolution
    try:
        ip = socket.gethostbyname("api.openai.com")
        print(f"✅ Resolved api.openai.com to IP: {ip}")
    except Exception as e:
        print(f"❌ DNS resolution failed: {e}")
        return False
    
    # Test TCP connection
    try:
        sock = socket.create_connection(("api.openai.com", 443), timeout=10)
        sock.close()
        print("✅ Successfully connected to api.openai.com:443")
        return True
    except Exception as e:
        print(f"❌ Connection failed: {e}")
        return False

def test_http_request():
    """Test HTTP request to OpenAI API"""
    print_section("HTTP REQUEST TEST")
    
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        print("❌ OPENAI_API_KEY not found in environment")
        return False
        
    print(f"🔑 Using API key: {api_key[:10]}...{api_key[-5:]}")
    
    url = "https://api.openai.com/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }
    payload = {
        "model": "gpt-3.5-turbo",
        "messages": [{"role": "user", "content": "Say 'Hello, World!'"}],
        "max_tokens": 10
    }
    
    try:
        import requests
        print("\nTesting with requests library...")
        response = requests.post(url, headers=headers, json=payload, timeout=30)
        print(f"Status: {response.status_code}")
        print(f"Response: {response.text[:200]}...")
        return True
    except Exception as e:
        print(f"❌ requests test failed: {e}")
        return False

def test_openai_client():
    """Test OpenAI client"""
    print_section("OPENAI CLIENT TEST")
    
    try:
        import openai
        
        # Configure client with explicit settings
        client = openai.OpenAI(
            api_key=os.getenv("OPENAI_API_KEY"),
            timeout=30.0,
            max_retries=3,
        )
        
        print("Testing chat completion...")
        response = client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[
                {"role": "system", "content": "You are a helpful assistant."},
                {"role": "user", "content": "Say 'Hello, World!'",
                }
            ],
            max_tokens=10,
            temperature=0.7,
        )
        
        print("✅ Success! Response:")
        print(response.choices[0].message.content)
        return True
        
    except Exception as e:
        print(f"❌ Error: {e}")
        if hasattr(e, 'response'):
            print(f"Response: {e.response.text if hasattr(e.response, 'text') else e.response}")
        return False

def main():
    """Main function"""
    print("\n" + "="*80)
    print(" OPENAI CLIENT DEBUGGER".ljust(80, '='))
    print("="*80)
    
    # Check environment
    if not check_environment():
        print("\n❌ Environment check failed.")
        return
    
    # Check network connectivity
    if not check_network_connectivity():
        print("\n❌ Network connectivity check failed.")
        return
    
    # Test HTTP request
    if not test_http_request():
        print("\n❌ HTTP request test failed.")
        return
    
    # Test OpenAI client
    if not test_openai_client():
        print("\n❌ OpenAI client test failed.")
        return
    
    print("\n✅ All tests completed successfully!")

if __name__ == "__main__":
    main()
