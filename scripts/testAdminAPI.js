/**
 * Admin API Test Suite
 * Quick tests to verify all admin endpoints are working
 * 
 * Usage:
 * 1. Start the server: npm run dev
 * 2. Update credentials below if needed
 * 3. Run: node scripts/testAdminAPI.js
 */

const https = require('https');
const http = require('http');

// Configuration
const BASE_URL = process.env.API_URL || 'http://localhost:3001';
const ADMIN_EMAIL = process.env.ADMIN_BOOTSTRAP_EMAIL || 'admin@example.com';
const ADMIN_PASSWORD = process.env.ADMIN_BOOTSTRAP_PASSWORD || 'ChangeMe!123';

let authToken = '';

// Helper function to make HTTP requests
function makeRequest(method, path, data = null, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const isHttps = url.protocol === 'https:';
    const client = isHttps ? https : http;
    
    const options = {
      method,
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname + url.search,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }

    const req = client.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          resolve({ status: res.statusCode, data: parsed });
        } catch {
          resolve({ status: res.statusCode, data: body });
        }
      });
    });

    req.on('error', reject);

    if (data) {
      req.write(JSON.stringify(data));
    }

    req.end();
  });
}

// Test cases
const tests = [
  {
    name: 'Health Check',
    run: async () => {
      const res = await makeRequest('GET', '/api/health');
      if (res.status === 200 && res.data.success) {
        return { passed: true, message: 'Server is running' };
      }
      return { passed: false, message: `Expected 200, got ${res.status}` };
    }
  },
  {
    name: 'Admin Login',
    run: async () => {
      const res = await makeRequest('POST', '/api/auth/login', {
        email: ADMIN_EMAIL,
        password: ADMIN_PASSWORD,
      });
      
      if (res.status === 200 && res.data.token) {
        authToken = res.data.token;
        return { passed: true, message: `Logged in as ${res.data.user.name} (${res.data.user.role})` };
      }
      return { passed: false, message: res.data.message || 'Login failed' };
    }
  },
  {
    name: 'Dashboard Stats',
    run: async () => {
      const res = await makeRequest('GET', '/api/admin/dashboard', null, authToken);
      if (res.status === 200 && res.data.success) {
        const { totals } = res.data.data;
        return { 
          passed: true, 
          message: `Users: ${totals.users}, Admins: ${totals.admins}, Family Tree: ${totals.familyTreeEntries}` 
        };
      }
      return { passed: false, message: res.data.message || 'Dashboard failed' };
    }
  },
  {
    name: 'List Users',
    run: async () => {
      const res = await makeRequest('GET', '/api/admin/users?page=1&limit=5', null, authToken);
      if (res.status === 200 && res.data.success) {
        return { 
          passed: true, 
          message: `Found ${res.data.pagination.total} users, showing ${res.data.data.length}` 
        };
      }
      return { passed: false, message: res.data.message || 'List users failed' };
    }
  },
  {
    name: 'Stats Overview',
    run: async () => {
      const res = await makeRequest('GET', '/api/admin/stats/overview', null, authToken);
      if (res.status === 200 && res.data.success) {
        const { users, content } = res.data.data;
        return { 
          passed: true, 
          message: `Users: ${users.total} (today ${users.today}), Content: committee ${content.committee}, sponsors ${content.sponsors}, offers ${content.offers}, events ${content.events}, places ${content.places}` 
        };
      }
      return { passed: false, message: res.data.message || 'Stats failed' };
    }
  },
  {
    name: 'Unauthorized Access Check',
    run: async () => {
      const res = await makeRequest('GET', '/api/admin/dashboard', null, null);
      if (res.status === 401) {
        return { passed: true, message: 'Correctly blocked unauthorized access' };
      }
      return { passed: false, message: 'Should have blocked unauthorized access' };
    }
  },
];

// Run tests
async function runTests() {
  console.log('\n🧪 Admin API Test Suite');
  console.log('='.repeat(60));
  console.log(`📍 Base URL: ${BASE_URL}`);
  console.log(`👤 Admin: ${ADMIN_EMAIL}`);
  console.log('='.repeat(60) + '\n');

  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    try {
      process.stdout.write(`${test.name.padEnd(30, '.')} `);
      const result = await test.run();
      
      if (result.passed) {
        console.log(`✅ ${result.message}`);
        passed++;
      } else {
        console.log(`❌ ${result.message}`);
        failed++;
      }
    } catch (error) {
      console.log(`❌ Error: ${error.message}`);
      failed++;
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('📊 Test Results:');
  console.log('='.repeat(60));
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📈 Total:  ${passed + failed}`);
  
  if (failed === 0) {
    console.log('\n🎉 All tests passed! Admin API is working correctly.');
  } else {
    console.log('\n⚠️  Some tests failed. Please check the errors above.');
  }
  
  console.log('\n📚 For detailed API documentation, see: ADMIN_DOCUMENTATION.md\n');
  
  process.exit(failed > 0 ? 1 : 0);
}

// Check if server is running
console.log('🔍 Checking if server is running...');
makeRequest('GET', '/api/health')
  .then(() => {
    console.log('✅ Server is running\n');
    return runTests();
  })
  .catch((err) => {
    console.error('❌ Server is not running or not accessible');
    console.error(`   ${err.message}`);
    console.log('\n💡 Please start the server first:');
    console.log('   cd backend && npm run dev\n');
    process.exit(1);
  });
