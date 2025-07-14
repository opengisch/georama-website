document.addEventListener("DOMContentLoaded", function () {
  const filterLinks = document.querySelectorAll('#region-filters a');

  filterLinks.forEach(link => {
    link.addEventListener('click', function (e) {
      e.preventDefault();

      // Toggle active class
      filterLinks.forEach(l => l.parentElement.classList.remove('active'));
      this.parentElement.classList.add('active');

      const region = this.getAttribute('data-region');

      // Filter partner panels
      const panels = document.querySelectorAll('.partner-row .col-sm-6');
      panels.forEach(panel => {
        const panelRegion = panel.querySelector('.panel-default')?.getAttribute('data-region');
        const show = region === 'world' || panelRegion === region;
        panel.style.display = show ? '' : 'none';
      });
    });
  });
});

