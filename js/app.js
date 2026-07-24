if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./service-worker.js');
}

const tabButtons = document.querySelectorAll('.tab-btn');
const views = {
  bestand: document.getElementById('view-bestand'),
  auffuellen: document.getElementById('view-auffuellen'),
  inventur: document.getElementById('view-inventur'),
  einstellungen: document.getElementById('view-einstellungen'),
};

tabButtons.forEach((btn) => {
  btn.addEventListener('click', () => {
    tabButtons.forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    Object.entries(views).forEach(([name, el]) => {
      el.classList.toggle('hidden', name !== btn.dataset.view);
    });
  });
});
