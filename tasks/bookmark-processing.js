const { spawn } = require('child_process');

module.exports = {
  run: async () => {
    console.log('🚀 Starting batch import via Taskmaster task plugin...');
    await new Promise((resolve, reject) => {
      const proc = spawn('node', ['batch-processor.js'], { stdio: 'inherit' });
      proc.on('exit', code => {
        if (code === 0) {
          console.log('✅ Batch import completed successfully.');
          resolve();
        } else {
          reject(new Error(`Batch import exited with code ${code}`));
        }
      });
    });
  }
};
