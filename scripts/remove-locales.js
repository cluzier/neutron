const fs = require('fs');
const path = require('path');

module.exports = async function (context) {
  // For Electron >= 8, locales are in Contents/Resources
  const resourcesDir = path.join(context.appOutDir, 'Contents', 'Resources');
  if (!fs.existsSync(resourcesDir)) return;

  const localeDirs = fs.readdirSync(resourcesDir).filter(name => name.endsWith('.lproj'));
  for (const dir of localeDirs) {
    if (dir !== 'en.lproj' && dir !== 'en_US.lproj') {
      const fullPath = path.join(resourcesDir, dir);
      try {
        fs.rmSync(fullPath, { recursive: true, force: true });
        console.log(`Removed locale: ${dir}`);
      } catch (e) {
        console.warn(`Failed to remove locale ${dir}:`, e);
      }
    }
  }
}; 