/**
 * --- CONFIGURATION CENTRAL ---
 * All application-specific logic lives here.
 */
var _wfx_settings = _wfx_settings || {};

var CONFIG = {
  // 1. GLOBAL SETTINGS
  settings: {
    interval: 100, // Check every 100ms
    timeout: 5000, // Stop checking after 5s

    // Valid tags to attach to.
    validInputTags: ["BUTTON", "INPUT", "DIV", "A", "SPAN", "ICON", "SVG"],

    // How deep to look up for the floating wrapper of the dropdown
    dropdownWrapperDepth: 30,
  },

  // 2. DISCOVERY RULES (The "Brain")
  rules: [
    // Rule 1: Standard ARIA Owns
    {
      name: "Standard ARIA Owns",
      inputSelector: '[aria-expanded="true"][aria-owns]',
      inputAttribute: "aria-owns",
      dropdownAttribute: "id",
      inputParentDepth: 0, // Use the element exactly as found
    },

    // Rule 2: Standard ARIA Controls
    {
      name: "Standard ARIA Controls",
      inputSelector: '[aria-expanded="true"][aria-controls]',
      inputAttribute: "aria-controls",
      dropdownAttribute: "id",
      inputParentDepth: 0,
    },

    // Rule 3: Example of DEPTH CONTROL
    // Scenario: You select the Icon, but want to track the Button wrapper
    // <button><icon data-target="menu1"></icon></button>
    {
      name: "Icon Trigger",
      inputSelector: "icon[data-target], svg[data-target]",
      inputAttribute: "data-target",
      dropdownAttribute: "id",
      inputParentDepth: 1, // <--- THIS MOVES SELECTION UP 1 LEVEL
    },

    // Rule 4: Custom Finder (Fluent UI)
    {
      name: "Simple Sibling Matcher",
      inputSelector: ".my-simple-menu-btn",
      mode: "custom",
      finderFn: "nextSiblingFinder", // Uses the simple function below
    },
  ],

  // 3. CUSTOM STRATEGIES
  strategies: {
    nextSiblingFinder: function (inputElement) {
      var next = inputElement.nextElementSibling;
      // Optional: Check if the next element looks like a dropdown
      if (next && (next.tagName === "UL" || next.tagName === "DIV")) {
        return next;
      }
      return null;
    },
  },

  // 4. MANUAL OVERRIDES
  manualPairs: [
    {
      inputSelector: '[id="js_2gx"]',
      dropdownSelector: '[data-ownerid="js_2gx"]',
      placement: "bottomCenter",
      offsetX: 0,
      offsetY: 0,
    },
  ],
};

// --- CORE ENGINE ---

function fetchRequiredElements() {
  var findRequiredElementsInterval = setInterval(function () {
    var allPairs = [];

    // A. PROCESS RULES
    for (var r = 0; r < CONFIG.rules.length; r++) {
      var rule = CONFIG.rules[r];
      var foundInputs = document.querySelectorAll(rule.inputSelector);

      // Filter & Normalize Inputs (Now handles DEPTH)
      var validInputs = processFoundInputs(foundInputs, rule);

      for (var i = 0; i < validInputs.length; i++) {
        var input = validInputs[i];

        // Find the partner Dropdown
        var dropdown = findDropdownByRule(input, rule);

        if (dropdown) {
          dropdown = findComponentWrapper(dropdown);

          // Pre-hide legacy check
          if (dropdown.style.visibility !== "hidden") {
            dropdown.style.visibility = "hidden";
          }
          allPairs.push({ input: input, dropdown: dropdown, config: null });
        }
      }
    }

    // B. PROCESS MANUAL PAIRS
    var manuals = checkManualConfigs();
    for (var m = 0; m < manuals.length; m++) allPairs.push(manuals[m]);

    // C. INITIALIZE FOUND PAIRS
    if (allPairs.length > 0) {
      clearInterval(findRequiredElementsInterval);

      var inputList = [];
      for (var p = 0; p < allPairs.length; p++)
        inputList.push(allPairs[p].input);
      var scrollParents = findScrollableParentElems(inputList);

      for (var k = 0; k < allPairs.length; k++) {
        var pair = allPairs[k];
        var scrollParent = scrollParents[k];

        // 1. Initial Latch
        updateDropdownPosition(
          pair.input,
          pair.dropdown,
          scrollParent,
          pair.config
        );

        // 2. Add Listeners
        if (scrollParent && scrollParent !== window) {
          scrollParent.addEventListener(
            "scroll",
            updateDropdownPosition.bind(
              null,
              pair.input,
              pair.dropdown,
              scrollParent,
              pair.config
            )
          );
        }
        window.addEventListener(
          "resize",
          updateDropdownPosition.bind(
            null,
            pair.input,
            pair.dropdown,
            scrollParent,
            pair.config
          )
        );
      }
    }
  }, CONFIG.settings.interval);

  setTimeout(function () {
    if (findRequiredElementsInterval)
      clearInterval(findRequiredElementsInterval);
  }, CONFIG.settings.timeout);
}

// --- HELPER: INPUT PROCESSOR (WITH DEPTH CONTROL) ---
function processFoundInputs(nodeList, rule) {
  var processed = [];
  var validTags = CONFIG.settings.validInputTags;

  // 1. Read Depth from Config (Default to 0)
  var depth = rule.inputParentDepth || 0;

  for (var i = 0; i < nodeList.length; i++) {
    var el = nodeList[i];
    var target = el;

    // 2. Climb the DOM Tree based on depth
    for (var d = 0; d < depth; d++) {
      if (target.parentElement) {
        target = target.parentElement;
      }
    }

    // 3. Validation Check (Is the resulting target valid?)
    if (validTags.indexOf(target.tagName) !== -1) {
      processed.push(target);
    }
    // Auto-Fix: If target is invalid but parent is valid, grab parent (legacy logic)
    else if (
      target.parentElement &&
      validTags.indexOf(target.parentElement.tagName) !== -1
    ) {
      processed.push(target.parentElement);
    }
  }
  return processed;
}

// --- HELPER: DROPDOWN FINDER ---
function findDropdownByRule(input, rule) {
  // Mode 1: Custom Function
  if (rule.mode === "custom") {
    var fnName = rule.finderFn;
    if (CONFIG.strategies[fnName]) {
      return CONFIG.strategies[fnName](input);
    }
    return null;
  }

  // Mode 2: Attribute Match
  // Note: We look at the ORIGINAL input element attributes if needed,
  // but usually attributes are on the element we selected.
  var matchValue = input.getAttribute(rule.inputAttribute);
  if (!matchValue) return null;

  var dropdown = null;
  if (rule.dropdownAttribute === "id") {
    dropdown = document.getElementById(matchValue);
  } else {
    var safeValue = matchValue.replace(/"/g, '\\"');
    var selector = "[" + rule.dropdownAttribute + '="' + safeValue + '"]';
    var candidates = document.querySelectorAll(selector);
    for (var i = 0; i < candidates.length; i++) {
      if (candidates[i] !== input) {
        dropdown = candidates[i];
        break;
      }
    }
  }
  return dropdown;
}

// --- STANDARD HELPERS ---

function checkManualConfigs() {
  var pairs = [];
  var manuals = CONFIG.manualPairs || [];
  for (var i = 0; i < manuals.length; i++) {
    var conf = manuals[i];
    var btn = document.querySelector(conf.inputSelector);
    var menu = document.querySelector(conf.dropdownSelector);
    if (btn && menu) {
      var style = window.getComputedStyle(menu);
      if (style.display !== "none" && style.visibility !== "hidden") {
        var realWrapper = findComponentWrapper(menu);
        pairs.push({ input: btn, dropdown: realWrapper, config: conf });
      }
    }
  }
  return pairs;
}

function findComponentWrapper(element) {
  if (!element) return null;
  var current = element;
  var lastPotentialWrapper = element;
  var depth = 0;
  var maxDepth = CONFIG.settings.dropdownWrapperDepth;

  while (current && current !== document.body && depth < maxDepth) {
    var style = window.getComputedStyle(current);
    var isFloating =
      style.position === "absolute" || style.position === "fixed";
    var hasLayering = parseInt(style.zIndex) > 0;
    if (isFloating || hasLayering) {
      lastPotentialWrapper = current;
      if (current.parentElement === document.body) return current;
    }
    if (
      current.hasAttribute("data-v-root") ||
      current.hasAttribute("data-reactroot")
    )
      return current;
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

// --- CORE: POSITION & UPDATE (With 90% Visibility & Safe Clipping) ---

function updateDropdownPosition(
  inputElement,
  drdnElement,
  scrollParent,
  config
) {
  if (!inputElement || !drdnElement) return;

  // 1. Reset
  drdnElement.style.position = "fixed";
  drdnElement.style.zIndex = "999999";
  drdnElement.style.display = "block";
  drdnElement.style.visibility = "hidden";
  drdnElement.style.margin = "0";

  // 2. Calibration
  drdnElement.style.top = "0px";
  drdnElement.style.left = "0px";
  var offsetTest = drdnElement.getBoundingClientRect();
  var parentShiftY = offsetTest.top;
  var parentShiftX = offsetTest.left;

  // 3. Measure
  var inputRect = inputElement.getBoundingClientRect();
  var drdnRect = drdnElement.getBoundingClientRect();
  var viewH = window.innerHeight;
  var viewW = window.innerWidth;

  // 4. Coordinates
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

  // 5. Apply
  drdnElement.style.top = targetTop - parentShiftY + "px";
  drdnElement.style.left = targetLeft - parentShiftX + "px";

  // 6. 90% Visibility & Clipping
  if (scrollParent && scrollParent !== window) {
    var pRect = scrollParent.getBoundingClientRect();

    // Intersection Math
    var overlapLeft = Math.max(inputRect.left, pRect.left);
    var overlapTop = Math.max(inputRect.top, pRect.top);
    var overlapRight = Math.min(inputRect.right, pRect.right);
    var overlapBottom = Math.min(inputRect.bottom, pRect.bottom);

    var overlapW = Math.max(0, overlapRight - overlapLeft);
    var overlapH = Math.max(0, overlapBottom - overlapTop);

    var visibleArea = overlapW * overlapH;
    var totalInputArea = inputRect.width * inputRect.height;
    var visibilityRatio = totalInputArea > 0 ? visibleArea / totalInputArea : 0;

    if (visibilityRatio < 0.9) {
      drdnElement.style.opacity = "0";
      drdnElement.style.pointerEvents = "none";
    } else {
      drdnElement.style.opacity = "1";
      drdnElement.style.pointerEvents = "auto";

      // Visual Clip
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
    drdnElement.style.opacity = "1";
    drdnElement.style.pointerEvents = "auto";
    drdnElement.style.clipPath = "none";
  }

  // 7. Latch
  if (drdnElement.getAttribute("data-latched") !== "true") {
    drdnElement.setAttribute("data-latched", "true");
    setTimeout(function () {
      updateDropdownPosition(inputElement, drdnElement, scrollParent, config);
    }, 0);
  }
  drdnElement.style.visibility = "visible";
}
fetchRequiredElements();
