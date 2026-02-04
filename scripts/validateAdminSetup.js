/**
 * Admin Setup Validation Script
 * Run this to verify the admin setup is complete and correct
 */

const fs = require('fs');
const path = require('path');

console.log('\n🔍 Validating Admin Setup...\n');

let errors = 0;
let warnings = 0;

// Check 1: Required files exist
console.log('📁 Checking Required Files:');
const requiredFiles = [
  'models/PageContent.js',
  'routes/admin.js',
  'scripts/bootstrapAdmin.js',
  '.env.example',
];

requiredFiles.forEach(file => {
  const filePath = path.join(__dirname, '..', file);
  if (fs.existsSync(filePath)) {
    console.log(`   ✅ ${file}`);
  } else {
    console.log(`   ❌ ${file} - MISSING`);
    errors++;
  }
});

// Check 2: Uploads directory
console.log('\n📂 Checking Uploads Directory:');
const uploadsDir = path.join(__dirname, '..', 'uploads');
if (fs.existsSync(uploadsDir)) {
  console.log('   ✅ uploads/ directory exists');
  
  // Check if writable
  try {
    const testFile = path.join(uploadsDir, '.test');
    fs.writeFileSync(testFile, 'test');
    fs.unlinkSync(testFile);
    console.log('   ✅ uploads/ directory is writable');
  } catch (err) {
    console.log('   ⚠️  uploads/ directory is not writable');
    warnings++;
  }
} else {
  console.log('   ❌ uploads/ directory missing - will be auto-created');
  warnings++;
}

// Check 3: Package dependencies
console.log('\n📦 Checking Dependencies:');
const packageJson = require('../package.json');
const requiredDeps = ['multer', 'express', 'mongoose', 'jsonwebtoken', 'bcryptjs'];

requiredDeps.forEach(dep => {
  if (packageJson.dependencies[dep]) {
    console.log(`   ✅ ${dep}: ${packageJson.dependencies[dep]}`);
  } else {
    console.log(`   ❌ ${dep} - MISSING`);
    errors++;
  }
});

// Check 4: Environment variables guidance
console.log('\n🔐 Environment Variables Guide:');
console.log('   Required for admin functionality:');
console.log('   • ADMIN_EMAILS - comma-separated admin emails');
console.log('   • ENABLE_ADMIN_BOOTSTRAP - set to "true" for auto-bootstrap');
console.log('   • ADMIN_BOOTSTRAP_EMAIL - admin email');
console.log('   • ADMIN_BOOTSTRAP_PASSWORD - admin password (change after first login)');
console.log('   • JWT_SECRET - secure secret key');
console.log('   • MONGODB_URI - database connection string');
console.log('\n   📄 See .env.example for full configuration');

// Check 5: Server.js modifications
console.log('\n⚙️  Checking Server Configuration:');
const serverPath = path.join(__dirname, '..', 'server.js');
if (fs.existsSync(serverPath)) {
  const serverContent = fs.readFileSync(serverPath, 'utf8');
  
  const checks = [
    { pattern: /require\(['"]\.\/routes\/admin['"]\)/, name: 'Admin routes import' },
    { pattern: /\/api\/admin/, name: 'Admin routes mount' },
    { pattern: /\/uploads/, name: 'Static uploads serving' },
    { pattern: /bootstrapAdmin/, name: 'Bootstrap admin import' },
  ];
  
  checks.forEach(check => {
    if (check.pattern.test(serverContent)) {
      console.log(`   ✅ ${check.name}`);
    } else {
      console.log(`   ❌ ${check.name} - NOT FOUND`);
      errors++;
    }
  });
} else {
  console.log('   ❌ server.js not found');
  errors++;
}

// Check 6: Middleware exists
console.log('\n🔒 Checking Middleware:');
const authMiddleware = path.join(__dirname, '..', 'middleware', 'auth.js');
if (fs.existsSync(authMiddleware)) {
  const authContent = fs.readFileSync(authMiddleware, 'utf8');
  if (authContent.includes('exports.protect') && authContent.includes('exports.authorize')) {
    console.log('   ✅ protect middleware found');
    console.log('   ✅ authorize middleware found');
  } else {
    console.log('   ⚠️  Middleware functions may be incomplete');
    warnings++;
  }
} else {
  console.log('   ❌ middleware/auth.js not found');
  errors++;
}

// Summary
console.log('\n' + '='.repeat(50));
console.log('📊 Validation Summary:');
console.log('='.repeat(50));

if (errors === 0 && warnings === 0) {
  console.log('✅ All checks passed! Admin setup is complete.');
  console.log('\n📝 Next Steps:');
  console.log('   1. Configure .env file (copy from .env.example)');
  console.log('   2. Set ENABLE_ADMIN_BOOTSTRAP=true');
  console.log('   3. Set admin credentials in .env');
  console.log('   4. Start the server: npm run dev');
  console.log('   5. Test admin endpoints (see ADMIN_DOCUMENTATION.md)');
} else {
  if (errors > 0) {
    console.log(`❌ ${errors} error(s) found - please fix before proceeding`);
  }
  if (warnings > 0) {
    console.log(`⚠️  ${warnings} warning(s) - may need attention`);
  }
}

console.log('\n📚 Documentation: backend/ADMIN_DOCUMENTATION.md');
console.log('');

process.exit(errors > 0 ? 1 : 0);
