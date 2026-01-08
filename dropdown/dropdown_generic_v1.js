var _wfx_settings = _wfx_settings || {};

var MANUAL_CONFIGS = [
  {
    inputSelector: '[id="js_2gx"]',
    dropdownSelector: '[data-ownerid="js_2gx"]',
    placement: "bottomCenter",
    offsetX: 0,
    offsetY: 0,
  },
];

function fetchRequiredElements() {
  var findRequiredElementsInterval = setInterval(function () {
    // A. Auto-Detect: ARIA and standard attributes
    var foundAutoInputs = document.querySelectorAll(
      '[aria-expanded="true"][aria-owns],[aria-expanded="true"][aria-controls]'
    );

    // B. Manual-Detect: Check config list
    var foundManualPairs = checkManualConfigs();

    if (foundAutoInputs.length > 0 || foundManualPairs.length > 0) {
      clearInterval(findRequiredElementsInterval);
      findRequiredElementsInterval = null;

      // 1. Process Auto-Detected
      var inputElements = getInputElements(foundAutoInputs);
      var drdnElements = getDrdnElements(inputElements);
      console.log(inputElements);
      console.log(drdnElements);
      // Create a config array matching the auto-elements (filled with null)
      var configs = [];

      for (var k = 0; k < inputElements.length; k++) {
        configs.push(null);
      }

      // 2. Process Manual Pairs (Add to the lists)
      for (var m = 0; m < foundManualPairs.length; m++) {
        inputElements.push(foundManualPairs[m].input);
        drdnElements.push(foundManualPairs[m].dropdown);
        configs.push(foundManualPairs[m].config);
      }

      // 3. Find Scroll Parents (Critical: Based on INPUT)
      var scrollableParentElements = findScrollableParentElems(inputElements);

      for (var i = 0; i < inputElements.length; i++) {
        var inputElem = inputElements[i];
        var drdnElem = drdnElements[i];
        var scrollableParentElement = scrollableParentElements[i];
        var currentConfig = configs[i];

        if (drdnElem && inputElem) {
          // Initial Position
          updateDropdownPosition(
            inputElem,
            drdnElem,
            scrollableParentElement,
            null,
            currentConfig
          );

          // Listeners
          if (scrollableParentElement && scrollableParentElement !== window) {
            scrollableParentElement.addEventListener(
              "scroll",
              updateDropdownPosition.bind(
                null,
                inputElem,
                drdnElem,
                scrollableParentElement,
                null,
                currentConfig
              )
            );
          }
          window.addEventListener(
            "resize",
            updateDropdownPosition.bind(
              null,
              inputElem,
              drdnElem,
              scrollableParentElement,
              null,
              currentConfig
            )
          );
        }
      }
    }
  }, 100);

  setTimeout(function () {
    if (findRequiredElementsInterval) {
      clearInterval(findRequiredElementsInterval);
      console.warn("Interval Timed Out - No active dropdowns found.");
    }
  }, 5000);
}
fetchRequiredElements();

// --- HELPERS: DISCOVERY ---

function checkManualConfigs() {
  var pairs = [];
  for (var i = 0; i < MANUAL_CONFIGS.length; i++) {
    var conf = MANUAL_CONFIGS[i];
    var btn = document.querySelector(conf.inputSelector);
    var menu = document.querySelector(conf.dropdownSelector);

    if (btn && menu) {
      // Ensure visible
      var style = window.getComputedStyle(menu);
      if (style.display !== "none" && style.visibility !== "hidden") {
        // Use Wrapper Hunter on manual selectors too
        var realWrapper = findComponentWrapper(menu);
        pairs.push({ input: btn, dropdown: realWrapper, config: conf });
      }
    }
  }
  return pairs;
}

function getInputElements(foundElems) {
  var inputElemsArray = [];
  for (var i = 0; i < foundElems.length; i++) {
    var foundElem = foundElems[i];
    var inputElem = foundElem;
    if (foundElem.tagName === "BUTTON" || foundElem.tagName === "INPUT") {
      //   var parent = foundElem.parentElement;
      var parent = foundElem;
      if (parent && parent.offsetWidth - foundElem.offsetWidth < 30) {
        inputElem = parent;
      }
    }
    inputElemsArray.push(inputElem);
  }
  return inputElemsArray;
}

function getDrdnElements(inputElems) {
  var drdnElemsArray = [];
  for (var i = 0; i < inputElems.length; i++) {
    var ariaOwns = inputElems[i].getAttribute("aria-owns");
    var ariaControls = inputElems[i].getAttribute("aria-controls");
    var btnId = inputElems[i].id;
    var drdnElem;

    if (ariaOwns) {
      drdnElem = document.getElementById(ariaOwns);
      if (!drdnElem)
        drdnElem = customDrdnFinderFunction(inputElems[i], ariaOwns);
    } else if (ariaControls) {
      drdnElem = document.getElementById(ariaControls);
    }

    // Apply Wrapper Hunter to ensure we grab the popover container
    if (drdnElem) {
      drdnElem = findComponentWrapper(drdnElem);
      // Hide initially to prevent flicker before latch
      if (drdnElem.style.visibility !== "hidden")
        drdnElem.style.visibility = "hidden";
    }
    drdnElemsArray.push(drdnElem);
  }
  return drdnElemsArray;
}

function customDrdnFinderFunction(inputElement, ariaOwnsValue) {
  try {
    var idPart = ariaOwnsValue.split("OverflowButton_")[1];
    if (!idPart) return null;
    var candidates = document.querySelectorAll('[id*="' + idPart + '"]');
    for (var i = 0; i < candidates.length; i++) {
      if (candidates[i].offsetWidth > 0 && candidates[i].offsetHeight > 0)
        return candidates[i];
    }
  } catch (e) {
    return null;
  }
  return null;
}

// --- HELPER: WRAPPER HUNTER ---
// function findComponentWrapper(element) {
//     var current = element;
//     var count = 0;
//     while (current && current !== document.body && count < 10) {
//         // Detect common libraries (SAP UI5, Fluent, etc)
//         if (current.classList.contains('sapMPopover') ||
//             current.classList.contains('sapMDialog') ||
//             current.classList.contains('sapMActionSheet') ||
//             current.hasAttribute('data-sap-ui-popup')) {
//             return current;
//         }
//         // Generic absolute container check
//         var style = window.getComputedStyle(current);
//         if (style.position === 'absolute' || style.position === 'fixed') {
//             // Avoid stopping at the internal list <ul>
//             if (!current.classList.contains('sapMList') && !current.classList.contains('sapMSelectList')) {
//                 return current;
//             }
//         }
//         current = current.parentElement;
//         count++;
//     }
//     return element;
// }

function findComponentWrapper(element) {
  if (!element) return null;

  let current = element;
  let lastPotentialWrapper = element;
  let depth = 0;
  const MAX_DEPTH = 30; // Increased to handle deep React/Vue trees

  while (current && current !== document.body && depth < MAX_DEPTH) {
    const style = window.getComputedStyle(current);
    const isFloating =
      style.position === "absolute" || style.position === "fixed";
    const hasLayering = parseInt(style.zIndex) > 0;
    const isFlexOrGrid = style.display === "flex" || style.display === "grid";

    // LOGIC: A wrapper is usually the HIGHEST element in a local tree
    // that still behaves like a container.
    if (isFloating || hasLayering) {
      lastPotentialWrapper = current;

      // If we hit a fixed/absolute element that is a direct child of
      // the body or a very high-level container, it's definitely the wrapper.
      if (current.parentElement === document.body) {
        return current;
      }
    }

    // Framework signal: many frameworks use data-attributes for roots
    if (
      current.hasAttribute("data-v-root") ||
      current.hasAttribute("data-reactroot")
    ) {
      return current;
    }

    current = current.parentElement;
    depth++;
  }

  return lastPotentialWrapper;
}

function findScrollableParentElems(inputElems) {
  var parents = [];
  for (var i = 0; i < inputElems.length; i++) {
    var p = inputElems[i].parentNode;
    var scrollParent = window;
    while (p && p !== document) {
      var s = window.getComputedStyle(p);
      if (
        (s.overflowY === "scroll" || s.overflowY === "auto") &&
        p.scrollHeight > p.clientHeight
      ) {
        scrollParent = p;
        break;
      }
      p = p.parentNode;
    }
    parents.push(scrollParent);
  }
  return parents;
}

// --- CORE: POSITION & UPDATE ---

function updateDropdownPosition(
  inputElement,
  drdnElement,
  scrollParent,
  config
) {
  if (!inputElement || !drdnElement) return;

  // 1. Reset and Prepare
  drdnElement.style.position = "fixed";
  drdnElement.style.zIndex = "999999";
  drdnElement.style.display = "block";
  drdnElement.style.visibility = "hidden";
  drdnElement.style.margin = "0";

  // 2. Detect Parent Displacement
  drdnElement.style.top = "0px";
  drdnElement.style.left = "0px";
  var offsetTest = drdnElement.getBoundingClientRect();
  var parentShiftY = offsetTest.top;
  var parentShiftX = offsetTest.left;

  // 3. Measure target and viewport
  var inputRect = inputElement.getBoundingClientRect();
  var drdnRect = drdnElement.getBoundingClientRect();
  var viewH = window.innerHeight;
  var viewW = window.innerWidth;

  // 4. Calculate Coordinates
  var vPos = config?.placement?.includes("top") ? "top" : "bottom";
  if (vPos === "bottom" && viewH - inputRect.bottom < drdnRect.height)
    vPos = "top";

  var targetTop =
    vPos === "bottom" ? inputRect.bottom : inputRect.top - drdnRect.height;
  var targetLeft = inputRect.left;

  if (config?.placement?.includes("right")) {
    targetLeft = inputRect.right - drdnRect.width;
  } else if (config?.placement?.includes("center")) {
    targetLeft = inputRect.left + inputRect.width / 2 - drdnRect.width / 2;
  }

  targetTop += config?.offsetY || 0;
  targetLeft += config?.offsetX || 0;

  if (targetLeft + drdnRect.width > viewW - 10)
    targetLeft = viewW - drdnRect.width - 10;
  if (targetLeft < 10) targetLeft = 10;

  // 5. Apply Final Position
  drdnElement.style.top = targetTop - parentShiftY + "px";
  drdnElement.style.left = targetLeft - parentShiftX + "px";

  // --- 6. LOGIC: 90% VISIBILITY CHECK & CLIPPING ---
  if (scrollParent && scrollParent !== window) {
    var pRect = scrollParent.getBoundingClientRect();

    // A. CALCULATE INTERSECTION AREA (Input vs ScrollParent)
    // 1. Find the overlapping rectangle coordinates
    var overlapLeft = Math.max(inputRect.left, pRect.left);
    var overlapTop = Math.max(inputRect.top, pRect.top);
    var overlapRight = Math.min(inputRect.right, pRect.right);
    var overlapBottom = Math.min(inputRect.bottom, pRect.bottom);

    // 2. Calculate dimensions of the overlap (clamped to 0 if no overlap)
    var overlapW = Math.max(0, overlapRight - overlapLeft);
    var overlapH = Math.max(0, overlapBottom - overlapTop);

    // 3. Calculate Areas
    var visibleArea = overlapW * overlapH;
    var totalInputArea = inputRect.width * inputRect.height;

    // 4. Calculate Ratio (0.0 to 1.0)
    var visibilityRatio = totalInputArea > 0 ? visibleArea / totalInputArea : 0;

    // B. DECISION: Is at least 90% visible?
    if (visibilityRatio < 0.9) {
      // Less than 90% visible -> Hide completely
      drdnElement.style.opacity = "0";
      drdnElement.style.pointerEvents = "none";
    } else {
      // 90% or more visible -> Show
      drdnElement.style.opacity = "1";
      drdnElement.style.pointerEvents = "auto";

      // C. APPLY CLIPPING (Polishing the edges)
      var clipTop = Math.max(0, pRect.top - targetTop);
      var clipBottom = Math.max(0, targetTop + drdnRect.height - pRect.bottom);
      var clipLeft = Math.max(0, pRect.left - targetLeft);
      var clipRight = Math.max(0, targetLeft + drdnRect.width - pRect.right);

      if (
        clipTop + clipBottom < drdnRect.height &&
        clipLeft + clipRight < drdnRect.width
      ) {
        drdnElement.style.clipPath =
          "inset(" +
          clipTop +
          "px " +
          clipRight +
          "px " +
          clipBottom +
          "px " +
          clipLeft +
          "px)";
      } else {
        drdnElement.style.clipPath = "none";
      }
    }
  } else {
    // No scroll parent context -> Always visible
    drdnElement.style.opacity = "1";
    drdnElement.style.pointerEvents = "auto";
    drdnElement.style.clipPath = "none";
  }

  // 7. Initial Latch
  if (drdnElement.getAttribute("data-latched") !== "true") {
    drdnElement.setAttribute("data-latched", "true");
    setTimeout(function () {
      updateDropdownPosition(inputElement, drdnElement, scrollParent, config);
    }, 0);
  }

  drdnElement.style.visibility = "visible";
}

function calculateDropdownPosition(
  targetElement,
  dropdownElement,
  preferredPlacement
) {
  var targetRect = targetElement.getBoundingClientRect();
  var dropdownRect = dropdownElement.getBoundingClientRect();
  var viewportWidth = window.innerWidth;
  var viewportHeight = window.innerHeight;

  var dropdownHeight = dropdownRect.height;
  var dropdownWidth = dropdownRect.width;

  var spaceAbove = targetRect.top;
  var spaceBelow = viewportHeight - targetRect.bottom;

  // Defaults
  var vPos = "bottom";
  var hPos = "left";

  // 1. Manual Override
  if (preferredPlacement) {
    var p = preferredPlacement.toLowerCase();
    if (p.indexOf("top") !== -1) vPos = "top";
    if (p.indexOf("center") !== -1) hPos = "center";
    if (p.indexOf("right") !== -1) hPos = "right";
    return { vPos: vPos, hPos: hPos };
  }

  // 2. Auto-Logic (Vertical)
  if (dropdownHeight > spaceAbove && dropdownHeight > spaceBelow) {
    vPos = "center";
  } else if (spaceBelow < dropdownHeight && spaceAbove >= dropdownHeight) {
    vPos = "top";
  }

  // 3. Auto-Logic (Horizontal)
  if (targetRect.left + dropdownWidth > viewportWidth) {
    if (targetRect.right - dropdownWidth >= 0) {
      hPos = "right";
    } else {
      hPos = "center";
    }
  }

  return { vPos: vPos, hPos: hPos };
}
