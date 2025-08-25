#!/usr/bin/env python3
"""Debug OpenAI API connection issues"""

import os
import sys
import json
import socket
import ssl
import urllib.request
import urllib.error
from datetime import datetime
from dotenv import load_dotenv

# Load environment variables
load_dotenv(override=True)

def check_network_connectivity():
    """Check basic network connectivity to OpenAI"""
    print("\n🔍 Checking network connectivity to OpenAI...")
    try:
        # Try to resolve the hostname
        ip = socket.gethostbyname("api.openai.com")
        print(f"✅ Resolved api.openai.com to IP: {ip}")
        
        # Try to connect to the API endpoint (port 443 for HTTPS)
        sock = socket.create_connection(("api.openai.com", 443), timeout=5)
        sock.close()
        print("✅ Successfully connected to api.openai.com:443")
        return True
    except socket.gaierror as e:
        print(f"❌ DNS resolution failed: {str(e)}")
        print("   Check your internet connection and DNS settings")
    except socket.timeout:
        print("❌ Connection timed out. Check your network connection or firewall settings")
    except socket.error as e:
        print(f"❌ Connection failed: {str(e)}")
    return False

def check_ssl_certificate():
    """Check SSL certificate for api.openai.com"""
    print("\n🔐 Checking SSL certificate...")
    try:
        context = ssl.create_default_context()
        with socket.create_connection(("api.openai.com", 443)) as sock:
            with context.wrap_socket(sock, server_hostname="api.openai.com") as ssock:
                cert = ssock.getpeercert()
                print(f"✅ SSL certificate is valid")
                print(f"   Issuer: {dict(x[0] for x in cert['issuer'])}")
                print(f"   Valid until: {cert['notAfter']}")
                return True
    except ssl.SSLError as e:
        print(f"❌ SSL certificate error: {str(e)}")
    except Exception as e:
        print(f"❌ Error checking SSL certificate: {str(e)}")
    return False

def test_http_request():
    """Test HTTP request to OpenAI API"""
    print("\n🌐 Testing HTTP request to OpenAI API...")
    url = "https://api.openai.com/v1/models"
    api_key = os.getenv("OPENAI_API_KEY")
    
    if not api_key:
        print("❌ OPENAI_API_KEY not found in environment")
        return False
        
    print(f"🔑 Using API key: {api_key[:10]}...{api_key[-5:]}")
    
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }
    
    try:
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req, timeout=10) as response:
            data = json.loads(response.read().decode())
            print("✅ Successfully connected to OpenAI API")
            print(f"📊 Available models: {len(data.get('data', []))}")
            if data.get('data'):
                for model in data['data'][:3]:  # Show first 3 models
                    print(f"   - {model['id']}")
            return True
            
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        print(f"❌ HTTP Error {e.code}: {e.reason}")
        try:
            error_data = json.loads(body)
            print(f"   Error: {error_data.get('error', {}).get('message', 'Unknown error')}")
        except:
            print(f"   Response: {body[:200]}")
            
    except urllib.error.URLError as e:
        print(f"❌ URL Error: {str(e)}")
        if "CERTIFICATE_VERIFY_FAILED" in str(e):
            print("   SSL Certificate verification failed. This might be due to:")
            print("   1. System certificates being out of date")
            print("   2. Network interception/proxy issues")
            print("   3. System time being incorrect")
    
    except Exception as e:
        print(f"❌ Unexpected error: {str(e)}")
        
    return False

def check_environment():
    """Check Python environment and dependencies"""
    print("\n🐍 Checking Python environment...")
    try:
        import platform
        import ssl
        
        print(f"Python version: {platform.python_version()}")
        print(f"OpenSSL version: {ssl.OPENSSL_VERSION}")
        print(f"System: {platform.system()} {platform.release()}")
        print(f"Current time: {datetime.now().isoformat()}")
        
        # Check if we can import openai package
        try:
            import openai
            print(f"✅ openai package version: {openai.__version__}")
            return True
        except ImportError:
            print("❌ openai package not installed. Install with: pip install openai")
            return False
            
    except Exception as e:
        print(f"❌ Error checking environment: {str(e)}")
        return False

def main():
    print("🚀 Starting OpenAI API Debugger")
    print("=" * 50)
    
    # Check environment first
    if not check_environment():
        print("\n❌ Environment check failed. Please fix the issues above.")
        return
    
    # Check network connectivity
    if not check_network_connectivity():
        print("\n❌ Network connectivity check failed. Please check your internet connection.")
        return
    
    # Check SSL certificate
    if not check_ssl_certificate():
        print("\n⚠️  SSL certificate check failed. This might cause connection issues.")
    
    # Test HTTP request
    if not test_http_request():
        print("\n❌ Failed to connect to OpenAI API. See error messages above for details.")
    else:
        print("\n✅ All checks passed! You should be able to use the OpenAI API.")

if __name__ == "__main__":
    main()
