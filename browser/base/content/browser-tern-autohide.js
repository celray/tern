/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

var TernAutohide = {
  init() {
    this.root = document.documentElement;
    this.toolbox = document.getElementById("navigator-toolbox");
    this.tabs = document.getElementById("TabsToolbar");
    this.navbar = document.getElementById("nav-bar");
    this.popups = new Set();
    this.listeners = [];
    this.edge = document.createXULElement("box");
    this.edge.id = "tern-toolbar-edge";
    document.body.appendChild(this.edge);
    this.listen(this.edge, "pointerenter", () => {
      this.hovered = true;
      this.show();
    });
    this.listen(this.edge, "pointerleave", () => {
      this.hovered = false;
      this.scheduleHide();
    });
    this.listen(this.toolbox, "pointerenter", event => {
      this.hovered = true;
      if (this.root.hasAttribute("tern-toolbars-shown") || event.clientY <= 4) {
        this.show();
      }
    });
    this.listen(this.toolbox, "pointerleave", () => {
      this.hovered = false;
      this.scheduleHide();
    });
    this.listen(window, "keydown", event => this.keydown(event), true);
    this.listen(window, "focusin", () => {
      if (this.toolbox.contains(document.activeElement)) {
        this.show();
      }
    });
    this.listen(window, "focusout", () => this.scheduleHide());
    this.listen(window, "popupshowing", event => {
      let popup = event.target;
      let anchor = popup.anchorNode || popup.triggerNode;
      if (
        this.toolbox.contains(popup) || this.toolbox.contains(anchor) ||
        this.popups.has(popup.parentElement?.closest("menupopup")) ||
        popup.id === "toolbar-context-menu"
      ) {
        this.popups.add(popup);
        this.show();
      }
    });
    this.listen(window, "popuphidden", event => {
      this.popups.delete(event.target);
      this.scheduleHide();
    });
    this.listen(this.tabs, "dragstart", () => {
      this.dragging = true;
      this.show();
    }, true);
    for (let name of ["dragend", "drop"]) {
      this.listen(window, name, () => {
        this.dragging = false;
        this.scheduleHide();
      }, true);
    }
    for (let name of ["fullscreen", "customizationstarting", "aftercustomization"]) {
      this.listen(window, name, () => requestAnimationFrame(() => this.update()));
    }
    this.listen(window, "DOMMenuBarInactive", () => this.scheduleHide());
    Services.prefs.addObserver("tern.autohide.", this);
    Services.prefs.addObserver("sidebar.verticalTabs", this);
    this.resizeObserver = new ResizeObserver(() => this.measure());
    this.resizeObserver.observe(this.toolbox);
    this.update();
    this.show(1500);
    window.addEventListener("unload", () => this.destroy(), { once: true });
  },

  listen(target, name, listener, capture = false) {
    target.addEventListener(name, listener, capture);
    this.listeners.push([target, name, listener, capture]);
  },

  observe() {
    this.update();
  },

  update() {
    let tabs = Services.prefs.getBoolPref("tern.autohide.tabs", true);
    let navbar = Services.prefs.getBoolPref("tern.autohide.navbar", true);
    this.enabled = (tabs || navbar) && !window.fullScreen &&
      !this.root.hasAttribute("customizing") &&
      !Services.prefs.getBoolPref("sidebar.verticalTabs", false) &&
      window.toolbar.visible;
    this.root.toggleAttribute("tern-autohide", this.enabled);
    this.root.toggleAttribute("tern-hide-tabs", tabs);
    this.root.toggleAttribute("tern-hide-navbar", navbar);
    this.hovered = false;
    requestAnimationFrame(() => this.measure());
    this.scheduleHide();
  },

  measure() {
    if (!this.enabled) {
      return;
    }
    let hidden = parseFloat(getComputedStyle(this.toolbox).borderBottomWidth) || 0;
    if (this.root.hasAttribute("tern-hide-tabs")) {
      hidden += this.tabs.getBoundingClientRect().height;
    }
    if (this.root.hasAttribute("tern-hide-navbar")) {
      hidden += this.navbar.getBoundingClientRect().height;
    }
    let fixed = Math.max(0, this.toolbox.getBoundingClientRect().height - hidden);
    this.root.style.setProperty("--tern-hidden-height", `${hidden}px`);
    this.root.style.setProperty("--tern-fixed-height", `${fixed}px`);
  },

  show(delay = 500) {
    clearTimeout(this.timer);
    this.root.setAttribute("tern-toolbars-shown", "");
    this.scheduleHide(delay);
  },

  scheduleHide(delay = 500) {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      if (
        this.hovered || this.dragging || this.popups.size ||
        this.toolbox.contains(document.activeElement) ||
        (document.getElementById("toolbar-menubar").getAttribute("autohide") === "true" &&
          !document.getElementById("toolbar-menubar").hasAttribute("inactive"))
      ) {
        return;
      }
      this.root.removeAttribute("tern-toolbars-shown");
    }, delay);
  },

  keydown(event) {
    let key = event.key.toLowerCase();
    let accel = event.ctrlKey || event.metaKey;
    if (
      (accel && ["l", "t", "k"].includes(key)) ||
      key === "f6" || key === "alt"
    ) {
      this.show(1000);
    } else if (event.ctrlKey && ["tab", "pageup", "pagedown"].includes(key)) {
      this.show(1000);
    } else if (key === "escape") {
      this.scheduleHide();
    }
  },

  destroy() {
    clearTimeout(this.timer);
    this.resizeObserver.disconnect();
    Services.prefs.removeObserver("tern.autohide.", this);
    Services.prefs.removeObserver("sidebar.verticalTabs", this);
    for (let [target, name, listener, capture] of this.listeners) {
      target.removeEventListener(name, listener, capture);
    }
    this.popups.clear();
  },
};

if (Services.appinfo.name === "AuraTern") {
  let onStartup = subject => {
    if (subject === window) {
      Services.obs.removeObserver(onStartup, "browser-delayed-startup-finished");
      TernAutohide.init();
    }
  };
  Services.obs.addObserver(onStartup, "browser-delayed-startup-finished");
  window.addEventListener("unload", () => {
    if (!TernAutohide.root) {
      Services.obs.removeObserver(onStartup, "browser-delayed-startup-finished");
    }
  }, { once: true });
}
