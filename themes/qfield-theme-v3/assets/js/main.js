// Simple test to verify script is running
console.log('Main.js script loaded at:', new Date().toISOString())

let isInitialized = false
let initAttempts = 0

function initializeApp() {
  initAttempts++
  console.log(`Initialization attempt #${initAttempts}, readyState: ${document.readyState}`)
  
  if (isInitialized) {
    console.log('App already initialized, skipping')
    return
  }
  
  // Check if we have the required elements before initializing
  const testFiltersContainer = document.querySelector('[data-success-stories-filters]')
  const testCards = document.querySelectorAll('.success-story-card')
  
  if (testFiltersContainer && testCards.length === 0) {
    console.log('Filter container found but no cards yet, will retry...')
    if (initAttempts < 10) {  // Limit retry attempts
      setTimeout(initializeApp, 100)
      return
    }
  }
  
  console.log('Initializing app, readyState:', document.readyState, 'at:', new Date().toISOString())
  isInitialized = true
  
  // Initialize Bootstrap tooltips if Bootstrap is available
  if (typeof bootstrap !== 'undefined') {
    const tooltipTriggerElements = document.querySelectorAll('[data-bs-toggle="tooltip"]')
    tooltipTriggerElements.forEach((triggerEl) => {
      new bootstrap.Tooltip(triggerEl)
    })
  }
  
  // Enhanced Sticky Navbar
  const navbar = document.querySelector('.navbar.sticky-top')
  if (navbar) {
    let lastScrollY = window.scrollY
    let isScrolled = false

    const handleScroll = () => {
      const currentScrollY = window.scrollY
      
      // Add scrolled class after scrolling down 10px
      if (currentScrollY > 10 && !isScrolled) {
        navbar.classList.add('scrolled')
        isScrolled = true
      } else if (currentScrollY <= 10 && isScrolled) {
        navbar.classList.remove('scrolled')
        isScrolled = false
      }

      lastScrollY = currentScrollY
    }

    // Throttle scroll events for better performance
    let ticking = false
    const scrollHandler = () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          handleScroll()
          ticking = false
        })
        ticking = true
      }
    }

    window.addEventListener('scroll', scrollHandler, { passive: true })
  }

  // Customer logos functionality
  const customers = document.getElementById('customers')
  if (customers) {
    customers.querySelectorAll('.customer-logos img').forEach((img) => {
      img.addEventListener('click', () => {
        const targets = customers.querySelectorAll(`*[title="${img.title}"]`)
        targets.forEach((el) => {
          Array.from(el.parentElement.children).forEach((sibling) => sibling.classList.remove('customer-active'))
          el.classList.add('customer-active')
        })
      })
    })
  }

  // Initialize galleries with a small delay to ensure all content is loaded
  setTimeout(initializeGalleries, 100)

  // Partner region filter controls
  const regionFiltersContainer = document.getElementById('region-filters')
  if (regionFiltersContainer) {
    const filterLinks = regionFiltersContainer.querySelectorAll('a[data-region]')
    const partnerPanels = document.querySelectorAll('.panel[data-region]')
    
    console.log('Partner region filter initialized:', { 
      filterLinks: filterLinks.length, 
      panels: partnerPanels.length 
    })

    const applyRegionFilter = (region) => {
      console.log('Applying region filter:', region)

      // Update active state on nav pills (Bootstrap 5 style)
      filterLinks.forEach((link) => {
        if (link.dataset.region === region) {
          link.classList.add('active')
        } else {
          link.classList.remove('active')
        }
      })

      // Show/hide partner panels based on region
      let visibleCount = 0
      partnerPanels.forEach((panel) => {
        const regions = (panel.dataset.region || '').split(/\s+/).filter(Boolean)
        const isVisible = region === 'world' || regions.includes(region)
        
        // Toggle visibility on the parent column
        const column = panel.closest('.col-sm-6, .col-md-4')
        if (column) {
          column.classList.toggle('d-none', !isVisible)
          if (isVisible) visibleCount++
        }
      })
      
      console.log('Region filter applied:', { region, visiblePanels: visibleCount })
    }

    // Set initial filter to 'world' (show all)
    applyRegionFilter('world')

    // Add click handlers to filter links
    filterLinks.forEach((link) => {
      link.addEventListener('click', (e) => {
        e.preventDefault()
        const region = link.dataset.region
        console.log('Region filter clicked:', region)
        applyRegionFilter(region)
      })
    })
  }

  // Success stories filter controls
  const filtersContainer = document.querySelector('[data-success-stories-filters]')
  console.log('Looking for filter container:', filtersContainer)
  
  // Manual test - add a global function for debugging
  window.testFilter = function(filterName) {
    const cards = document.querySelectorAll('.success-story-card')
    console.log('Manual test - found cards:', cards.length)
    cards.forEach((card, index) => {
      const categories = (card.dataset.categories || '').split(/\s+/).filter(Boolean)
      const isVisible = filterName === 'all' || categories.includes(filterName)
      card.classList.toggle('d-none', !isVisible)
      console.log(`Card ${index}:`, { categories: card.dataset.categories, visible: isVisible })
    })
  }
  
  if (filtersContainer) {
    const filterButtons = filtersContainer.querySelectorAll('button[data-filter]')
    const cards = document.querySelectorAll('.success-story-card')
    
    console.log('Filter system initialized:', { 
      filterButtons: filterButtons.length, 
      cards: cards.length 
    })
    
    // Test if the first card has the expected data
    if (cards.length > 0) {
      console.log('First card data-categories:', cards[0].dataset.categories)
    }

    const applyFilter = (filter) => {
      const supportedFilters = Array.from(filterButtons).map((button) => button.dataset.filter)
      const normalizedFilter = supportedFilters.includes(filter) ? filter : 'all'
      
      console.log('Applying filter:', { filter, normalizedFilter, supportedFilters })

      filterButtons.forEach((button) => {
        const isActive = button.dataset.filter === normalizedFilter
        button.classList.toggle('active', isActive)
        button.setAttribute('aria-pressed', isActive ? 'true' : 'false')
      })

      let visibleCount = 0
      cards.forEach((card) => {
        const categories = (card.dataset.categories || '').split(/\s+/).filter(Boolean)
        const isVisible = normalizedFilter === 'all' || categories.includes(normalizedFilter)
        card.classList.toggle('d-none', !isVisible)
        if (isVisible) visibleCount++
        
        if (!isVisible && normalizedFilter !== 'all') {
          console.log('Hiding card:', { 
            categories: card.dataset.categories, 
            parsed: categories, 
            filter: normalizedFilter,
            includes: categories.includes(normalizedFilter)
          })
        }
      })
      
      console.log('Filter applied:', { filter: normalizedFilter, visibleCards: visibleCount })
    }

    const urlParams = new URLSearchParams(window.location.search)
    const initialFilter = urlParams.get('filter') || 'all'
    applyFilter(initialFilter)

    filterButtons.forEach((button) => {
      button.addEventListener('click', (e) => {
        console.log('Filter button clicked:', button.dataset.filter)
        const filter = button.getAttribute('data-filter')
        const nextUrl = `${window.location.pathname}?filter=${encodeURIComponent(filter)}`
        if (window.history && history.pushState) {
          history.pushState({ filter }, '', nextUrl)
        }
        applyFilter(filter)
      })
    })

    window.addEventListener('popstate', (event) => {
      const filter = event.state?.filter || 'all'
      applyFilter(filter)
    })
  }

  // Blog view toggle controls
  const blogViewGrid = document.querySelector('[data-blog-view-grid]')
  const blogViewToggleButtons = document.querySelectorAll('[data-blog-view-toggle]')

  if (blogViewGrid && blogViewToggleButtons.length > 0) {
    const storageKey = 'qfieldBlogView'
    const allowedViews = ['cards', 'list']
    const defaultView = 'list'

    const setActiveButton = (view) => {
      blogViewToggleButtons.forEach((btn) => {
        const isActive = btn.dataset.view === view
        btn.classList.toggle('active', isActive)
        btn.setAttribute('aria-pressed', isActive ? 'true' : 'false')
      })
    }

    const applyView = (view) => {
      const normalized = allowedViews.includes(view) ? view : defaultView
      blogViewGrid.classList.remove('blog-view--cards', 'blog-view--list')
      blogViewGrid.classList.add(`blog-view--${normalized}`)
      setActiveButton(normalized)
    }

    const savedView = window.localStorage ? localStorage.getItem(storageKey) : null
    applyView(savedView)

    blogViewToggleButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const view = btn.dataset.view
        applyView(view)
        if (window.localStorage) {
          localStorage.setItem(storageKey, view)
        }
      })
    })
  }
}

// Reset initialization on page navigation (for SPAs or cached pages)
if ('addEventListener' in window) {
  window.addEventListener('beforeunload', () => {
    isInitialized = false
    initAttempts = 0
  })
}

// Multiple initialization strategies for different loading scenarios
function tryInitialization() {
  console.log('Trying initialization, readyState:', document.readyState)
  
  // Strategy 1: DOM ready check
  if (document.readyState === 'loading') {
    console.log('Document still loading, adding DOMContentLoaded listener')
    document.addEventListener('DOMContentLoaded', initializeApp, { once: true })
  } else {
    // DOM is already ready, initialize immediately
    console.log('Document already loaded, initializing immediately')
    initializeApp()
  }
  
  // Strategy 2: Window load backup
  window.addEventListener('load', () => {
    console.log('Window load event fired')
    if (!isInitialized) {
      console.log('Not yet initialized, trying now')
      initializeApp()
    }
  }, { once: true })
  
  // Strategy 3: Delayed backup for cached pages
  setTimeout(() => {
    if (!isInitialized) {
      console.log('Delayed backup initialization')
      initializeApp()
    }
  }, 250)
}

// Gallery initialization function
function initializeGalleries() {
  const galleryWrappers = document.querySelectorAll('.gallery-wrapper[data-gallery-id]')
  console.log('Initializing galleries:', galleryWrappers.length)
  
  // Log all gallery IDs found
  galleryWrappers.forEach((wrapper, index) => {
    console.log(`Found gallery ${index + 1}:`, wrapper.dataset.galleryId)
  })
  
  if (galleryWrappers.length === 0) {
    console.log('No gallery wrappers found, will retry in 100ms')
    setTimeout(initializeGalleries, 100)
    return
  }
  
  galleryWrappers.forEach(galleryWrapper => {
    const galleryId = galleryWrapper.dataset.galleryId
    const autoplay = galleryWrapper.dataset.autoplay === 'true'
    const interval = galleryWrapper.dataset.interval || '5000'
    const controls = galleryWrapper.dataset.controls !== 'false'
    const indicators = galleryWrapper.dataset.indicators !== 'false'
    
    console.log(`Processing gallery ${galleryId}`)
    
    const figures = galleryWrapper.querySelectorAll('figure')
    console.log(`Gallery ${galleryId} found ${figures.length} figures`)
    
    if (figures.length === 0) {
      console.log(`Gallery ${galleryId} has no figures, hiding wrapper`)
      galleryWrapper.style.display = 'none'
      return
    }
    
    // Create carousel structure
    const carousel = document.createElement('div')
    carousel.id = galleryId
    carousel.className = 'carousel slide gallery-carousel mb-4'
    if (autoplay) {
      carousel.setAttribute('data-bs-ride', 'carousel')
    }
    carousel.setAttribute('data-bs-interval', interval)
    
    let carouselHTML = ''
    
    // Add indicators if more than one figure and enabled
    if (indicators && figures.length > 1) {
      carouselHTML += '<div class="carousel-indicators">'
      for (let i = 0; i < figures.length; i++) {
        carouselHTML += `<button type="button" data-bs-target="#${galleryId}" data-bs-slide-to="${i}" 
                         ${i === 0 ? 'class="active" aria-current="true"' : ''} 
                         aria-label="Slide ${i + 1}"></button>`
      }
      carouselHTML += '</div>'
    }
    
    // Add carousel inner
    carouselHTML += '<div class="carousel-inner">'
    figures.forEach((figure, index) => {
      carouselHTML += `<div class="carousel-item${index === 0 ? ' active' : ''}">`
      carouselHTML += figure.outerHTML
      carouselHTML += '</div>'
    })
    carouselHTML += '</div>'
    
    // Add controls if more than one figure and enabled
    if (controls && figures.length > 1) {
      carouselHTML += `
        <button class="carousel-control-prev" type="button" data-bs-target="#${galleryId}" data-bs-slide="prev">
          <span class="carousel-control-prev-icon" aria-hidden="true"></span>
          <span class="visually-hidden">Previous</span>
        </button>
        <button class="carousel-control-next" type="button" data-bs-target="#${galleryId}" data-bs-slide="next">
          <span class="carousel-control-next-icon" aria-hidden="true"></span>
          <span class="visually-hidden">Next</span>
        </button>
      `
    }
    
    carousel.innerHTML = carouselHTML
    
    // Replace the wrapper with the carousel
    galleryWrapper.parentNode.replaceChild(carousel, galleryWrapper)
    
    // Add click handlers for fullscreen
    const galleryImages = carousel.querySelectorAll('.gallery-img')
    galleryImages.forEach((img, index) => {
      img.style.cursor = 'pointer'
      img.addEventListener('click', (e) => {
        e.preventDefault()
        openGalleryFullscreen(galleryId, index)
      })
    })
    
    // Initialize Bootstrap carousel
    if (typeof bootstrap !== 'undefined' && bootstrap.Carousel) {
      try {
        new bootstrap.Carousel(carousel, {
          interval: parseInt(interval),
          ride: autoplay ? 'carousel' : false,
          pause: 'hover',
          wrap: true,
          keyboard: true,
          touch: true
        })
        console.log(`Gallery ${galleryId} Bootstrap carousel initialized`)
      } catch (error) {
        console.error(`Failed to initialize Bootstrap carousel for ${galleryId}:`, error)
      }
    } else {
      console.warn('Bootstrap not available for carousel initialization')
    }
    
    console.log(`Gallery ${galleryId} initialized successfully with ${figures.length} slides`)
  })
}

// Fullscreen gallery lightbox
function openGalleryFullscreen(galleryId, startIndex = 0) {
  const carousel = document.getElementById(galleryId)
  if (!carousel) return
  
  const images = Array.from(carousel.querySelectorAll('.gallery-img')).map(img => ({
    src: img.src,
    alt: img.alt || '',
    caption: img.closest('figure')?.querySelector('figcaption')?.textContent || ''
  }))
  
  if (images.length === 0) return
  
  // Create lightbox overlay
  const lightbox = document.createElement('div')
  lightbox.className = 'gallery-lightbox'
  lightbox.innerHTML = `
    <div class="gallery-lightbox__backdrop"></div>
    <div class="gallery-lightbox__container">
      <button class="gallery-lightbox__close" aria-label="Close gallery">×</button>
      ${images.length > 1 ? `
        <button class="gallery-lightbox__prev" aria-label="Previous image">
          <span class="carousel-control-prev-icon"></span>
        </button>
        <button class="gallery-lightbox__next" aria-label="Next image">
          <span class="carousel-control-next-icon"></span>
        </button>
      ` : ''}
      <div class="gallery-lightbox__content">
        <img class="gallery-lightbox__image" src="${images[startIndex].src}" alt="${images[startIndex].alt}">
        ${images[startIndex].caption ? `<div class="gallery-lightbox__caption">${images[startIndex].caption}</div>` : ''}
      </div>
      ${images.length > 1 ? `
        <div class="gallery-lightbox__counter">${startIndex + 1} / ${images.length}</div>
      ` : ''}
    </div>
  `
  
  document.body.appendChild(lightbox)
  document.body.style.overflow = 'hidden'
  
  let currentIndex = startIndex
  
  const updateImage = (index) => {
    currentIndex = index
    const img = lightbox.querySelector('.gallery-lightbox__image')
    const caption = lightbox.querySelector('.gallery-lightbox__caption')
    const counter = lightbox.querySelector('.gallery-lightbox__counter')
    
    img.src = images[index].src
    img.alt = images[index].alt
    
    if (caption) {
      if (images[index].caption) {
        caption.textContent = images[index].caption
        caption.style.display = 'block'
      } else {
        caption.style.display = 'none'
      }
    }
    
    if (counter) {
      counter.textContent = `${index + 1} / ${images.length}`
    }
  }
  
  const closeLightbox = () => {
    lightbox.remove()
    document.body.style.overflow = ''
  }
  
  const showPrev = () => {
    const newIndex = currentIndex > 0 ? currentIndex - 1 : images.length - 1
    updateImage(newIndex)
  }
  
  const showNext = () => {
    const newIndex = currentIndex < images.length - 1 ? currentIndex + 1 : 0
    updateImage(newIndex)
  }
  
  // Event listeners
  lightbox.querySelector('.gallery-lightbox__close')?.addEventListener('click', closeLightbox)
  lightbox.querySelector('.gallery-lightbox__backdrop')?.addEventListener('click', closeLightbox)
  lightbox.querySelector('.gallery-lightbox__prev')?.addEventListener('click', showPrev)
  lightbox.querySelector('.gallery-lightbox__next')?.addEventListener('click', showNext)
  
  // Keyboard navigation
  const handleKeyboard = (e) => {
    if (e.key === 'Escape') closeLightbox()
    else if (e.key === 'ArrowLeft') showPrev()
    else if (e.key === 'ArrowRight') showNext()
  }
  
  document.addEventListener('keydown', handleKeyboard)
  lightbox.addEventListener('remove', () => {
    document.removeEventListener('keydown', handleKeyboard)
  })
  
  // Animate in
  requestAnimationFrame(() => {
    lightbox.classList.add('gallery-lightbox--active')
  })
}

// Donation page functionality
function initializeDonationPage() {
  const donateLink = document.getElementById('donate-link')
  if (!donateLink) return // Not on donation page
  
  // Amount selection - handle clicks on donation buttons
  document.querySelectorAll('.donation-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.preventDefault()
      
      // Get active tab to only update buttons in current tab
      const activeTab = document.querySelector('.tab-pane.active')
      if (activeTab) {
        activeTab.querySelectorAll('.donation-btn').forEach(b => b.classList.remove('selected'))
      }
      
      btn.classList.add('selected')
      donateLink.href = btn.href
    })
  })
  
  // Set initial donate link from the first selected button
  const initialSelected = document.querySelector('.donation-btn.selected')
  if (initialSelected) {
    donateLink.href = initialSelected.href
  }
  
  // Update donate link when tab changes (Bootstrap 5 tab events)
  document.querySelectorAll('.donation-tab').forEach(tab => {
    tab.addEventListener('shown.bs.tab', function (event) {
      // Find first button in newly shown tab and select it
      const targetId = this.getAttribute('data-bs-target')
      const targetPane = document.querySelector(targetId)
      
      if (targetPane) {
        const firstBtn = targetPane.querySelector('.donation-btn')
        if (firstBtn) {
          // Clear all selections in the new tab
          targetPane.querySelectorAll('.donation-btn').forEach(b => b.classList.remove('selected'))
          // Select the first button
          firstBtn.classList.add('selected')
          donateLink.href = firstBtn.href
        }
      }
    })
  })
}

// Thank you page - copy donate link functionality
function copyDonateLink() {
  const donateUrl = 'https://qfield.org/donate'
  
  navigator.clipboard.writeText(donateUrl)
    .then(() => {
      // Show a temporary success message
      const btn = event.target.closest('button')
      const originalHTML = btn.innerHTML
      btn.innerHTML = '<i class="fas fa-check"></i>'
      btn.classList.remove('btn-outline-secondary')
      btn.classList.add('btn-success')
      
      setTimeout(() => {
        btn.innerHTML = originalHTML
        btn.classList.remove('btn-success')
        btn.classList.add('btn-outline-secondary')
      }, 2000)
    })
    .catch((error) => {
      console.error('Clipboard copy failed:', error)
      alert('Failed to copy the link. Please try again.')
    })
}

// Make function available globally
if (typeof window !== 'undefined') {
  window.copyDonateLink = copyDonateLink
}

// Start initialization
tryInitialization()
initializeDonationPage()

