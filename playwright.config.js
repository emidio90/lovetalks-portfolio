import {defineConfig} from '@playwright/test';
export default defineConfig({
  testDir:'./tests/browser',
  timeout:15000,
  fullyParallel:false,
  workers:1,
  forbidOnly:!!process.env.CI,
  retries:0,
  reporter:'list',
  use:{baseURL:'http://127.0.0.1:4317',headless:true,launchOptions:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ? {executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE} : {}},
  projects:[{name:'desktop',use:{viewport:{width:1440,height:1050}}},{name:'mobile',use:{viewport:{width:390,height:844},isMobile:true,hasTouch:true}}],
  webServer:{command:'node server/index.js',env:{APP_MODE:'demo',HOST:'127.0.0.1',PORT:'4317',RATE_LIMIT_PER_MINUTE:'60'},url:'http://127.0.0.1:4317/api/health',reuseExistingServer:false,timeout:10000},
});
