  // Show/hide button
  const scrollBtn = document.getElementById('scrollTopBtn');
  window.addEventListener('scroll', () => {
    if (document.documentElement.scrollTop > 300 || document.body.scrollTop > 300)
      scrollBtn.style.display = 'block';
    else
      scrollBtn.style.display = 'none';
  });

  // Scroll to top smoothly
  scrollBtn.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });