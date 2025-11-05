const { contextBridge } = require('electron');
const os = require('node:os');

contextBridge.exposeInMainWorld('aktieTipset', {
  platform: process.platform,
  arch: process.arch,
  release: os.release()
});
