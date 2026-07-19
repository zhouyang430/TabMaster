document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('next-btn').addEventListener('click', () => {
    chrome.storage.local.set({ tabmasterFirstRun: false }, () => {
      window.close();
    });
  });

  document.getElementById('skip-btn').addEventListener('click', () => {
    chrome.storage.local.set({ tabmasterFirstRun: false }, () => {
      window.close();
    });
  });
});