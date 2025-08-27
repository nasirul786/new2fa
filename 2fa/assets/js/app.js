class TelegramAuthenticator {
  constructor() {
    this.tg = window.Telegram.WebApp
    this.currentScreen = "loading-screen"
    this.screenHistory = []
    this.currentPin = ""
    this.confirmPin = ""
    this.isSettingPin = false
    this.accounts = []
    this.user = null
    this.selectedColor = "#2196F3"
    this.selectedIcon = "key"
    this.editingAccount = null
    this.simpleIcons = []
    this.timer = null
    this.remainingTime = 30
    this.exportToken = null
    this.lottie = window.lottie // Declare lottie variable

    this.init()
  }

  async init() {
    try {
      this.initLottieAnimations()

      // Initialize Telegram WebApp
      this.tg = window.Telegram.WebApp
      this.tg.ready()
      this.tg.expand()

      // Apply Telegram theme
      this.applyTelegramTheme()

      // Setup event listeners
      this.setupEventListeners()

      // Check for start params (import)
      this.checkStartParams()

      // Authenticate user
      await this.authenticateUser()
    } catch (error) {
      console.error("Initialization error:", error)
    }
  }

  applyTelegramTheme() {
    const themeParams = this.tg.themeParams
    const root = document.documentElement

    Object.keys(themeParams).forEach((key) => {
      const cssVar = `--tg-theme-${key.replace(/([A-Z])/g, "-$1").toLowerCase()}`
      root.style.setProperty(cssVar, themeParams[key])
    })
  }

  setupEventListeners() {
    // PIN keyboard
    document.querySelectorAll(".pin-key").forEach((key) => {
      key.addEventListener("click", (e) => this.handlePinInput(e))
    })

    // Navigation buttons
    document.getElementById("add-button").addEventListener("click", () => this.showScreen("add-method-screen"))
    document.getElementById("settings-button").addEventListener("click", () => this.showScreen("settings-screen"))

    // Add method buttons
    document.getElementById("scan-qr-button").addEventListener("click", () => this.scanQRCode())
    document
      .getElementById("manual-entry-button")
      .addEventListener("click", () => this.showScreen("manual-entry-screen"))

    // Form inputs
    document.getElementById("secret-input").addEventListener("input", (e) => this.validateSecretKey(e.target.value))

    // Color and icon selection
    document.querySelectorAll(".color-item").forEach((item) => {
      item.addEventListener("click", (e) => this.selectColor(e))
    })

    document.querySelectorAll(".icon-item").forEach((item) => {
      item.addEventListener("click", (e) => this.selectIcon(e))
    })

    document.getElementById("more-icons-button").addEventListener("click", () => this.showScreen("browse-icons-screen"))

    // Settings items
    document.getElementById("password-setting").addEventListener("click", () => this.showPasswordScreen())
    document.getElementById("transfer-codes-setting").addEventListener("click", () => this.showTransferScreen())
    document.getElementById("remove-all-setting").addEventListener("click", () => this.showScreen("remove-all-screen"))

    // Transfer tabs
    document.querySelectorAll(".transfer-tab").forEach((tab) => {
      tab.addEventListener("click", (e) => this.switchTransferTab(e.target.dataset.tab))
    })

    // Copy buttons
    document.getElementById("copy-link-button").addEventListener("click", () => this.copyExportLink())

    // Delete button
    document.getElementById("delete-account-button").addEventListener("click", () => this.deleteAccount())

    // Icon search
    document.getElementById("icon-search").addEventListener("input", (e) => this.searchIcons(e.target.value))

    // Color picker
    document.getElementById("custom-color-picker").addEventListener("click", () => this.showColorPicker())
    document.getElementById("cancel-color").addEventListener("click", () => this.hideColorPicker())
    document.getElementById("confirm-color").addEventListener("click", () => this.confirmColorSelection())

    // Keep unlocked toggle
    document
      .getElementById("keep-unlocked-checkbox")
      .addEventListener("change", (e) => this.toggleKeepUnlocked(e.target.checked))

    // Help button
    document.getElementById("keep-unlocked-help").addEventListener("click", () => this.showKeepUnlockedHelp())

    // Telegram back button
    this.tg.BackButton.onClick(() => this.handleBackButton())

    // Main button
    this.tg.MainButton.onClick(() => this.handleMainButton())
  }

  initLottieAnimations() {
    // Define Lottie animations for each screen
    this.lottieAnimations = {
      loading: null,
      pin: null,
      empty: null,
      addMethod: null,
      manualEntry: null,
      accountForm: null,
      browseIcons: null,
      password: null,
      transferLink: null,
      removeAll: null,
      import: null,
    }

    // Load animations when containers are visible
    this.loadLottieAnimation("loading", "assets/lottie/loading.json")
    this.loadLottieAnimation("empty", "assets/lottie/empty.json")
  }

  loadLottieAnimation(name, path) {
    const container = document.getElementById(`${name}-lottie`)
    if (container && !this.lottieAnimations[name]) {
      try {
        this.lottieAnimations[name] = this.lottie.loadAnimation({
          container: container,
          renderer: "svg",
          loop: name === "loading" || name === "empty",
          autoplay: true,
          path: path,
        })

        // Add click to replay for non-loading animations
        if (name !== "loading") {
          container.addEventListener("click", () => {
            if (this.lottieAnimations[name]) {
              this.lottieAnimations[name].goToAndPlay(0)
            }
          })
        }
      } catch (error) {
        console.log(`[v0] Failed to load ${name} animation:`, error)
        // Hide container if animation fails to load
        container.style.display = "none"
      }
    }
  }

  playLottieAnimation(name) {
    if (this.lottieAnimations[name]) {
      this.lottieAnimations[name].goToAndPlay(0)
    }
  }

  async checkStartParams() {
    const startParam = this.tg.initDataUnsafe.start_param
    if (startParam && startParam.startsWith("exportdata")) {
      const token = startParam.replace("exportdata", "")
      await this.importAccounts(token)
    }
  }

  async authenticateUser() {
    try {
      const initData = this.tg.initData
      console.log("[v0] Authenticating with init data:", initData ? "present" : "missing")
      console.log("[v0] Init data length:", initData ? initData.length : 0)

      const response = await fetch("api/auth.php", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ init_data: initData }),
      })

      console.log("[v0] Response status:", response.status)
      console.log("[v0] Response headers:", response.headers.get("content-type"))

      const responseText = await response.text()
      console.log("[v0] Raw response text:", responseText)
      console.log("[v0] Response text length:", responseText.length)

      if (!response.ok) {
        console.error("[v0] HTTP error response:", responseText)
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const contentType = response.headers.get("content-type")
      if (!contentType || !contentType.includes("application/json")) {
        console.error("[v0] Non-JSON response:", responseText)
        throw new Error("Server returned non-JSON response")
      }

      if (!responseText.trim()) {
        throw new Error("Empty response from server")
      }

      let result
      try {
        result = JSON.parse(responseText)
      } catch (parseError) {
        console.error("[v0] JSON parse error:", parseError)
        console.error("[v0] Failed to parse:", responseText)
        throw new Error("Invalid JSON response from server")
      }

      console.log("[v0] Authentication result:", result)

      if (result.success) {
        this.user = result.user

        // Check if PIN is required
        if (this.user.pin_hash && !this.isUnlocked()) {
          this.showScreen("pin-screen")
        } else {
          await this.loadAccounts()
          this.populateHomeHeader()
          this.showScreen("main-screen")
          this.startTimer()
        }
      } else {
        this.showError(result.error || "Authentication failed")
      }
    } catch (error) {
      console.error("Authentication error:", error)
      if (error.message.includes("JSON")) {
        this.showError("Server response error. Please check configuration.")
      } else if (error.message.includes("HTTP error")) {
        this.showError("Server error. Please try again.")
      } else {
        this.showError("Connection failed")
      }
    }
  }

  isUnlocked() {
    if (!this.user.keep_unlocked) return false

    const lastLogin = new Date(this.user.last_login)
    const now = new Date()
    const hoursDiff = (now - lastLogin) / (1000 * 60 * 60)

    return hoursDiff < 24
  }

  async loadAccounts() {
    try {
      const response = await fetch("api/accounts.php", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${this.tg.initData}`,
        },
      })

      const result = await response.json()

      if (result.success) {
        this.accounts = result.accounts
        if (typeof result.remaining_time === "number") {
          this.remainingTime = Math.max(1, Math.ceil(result.remaining_time))
        }
        this.renderAccounts()
        this.updateAccountsCount()
      }
    } catch (error) {
      console.error("Failed to load accounts:", error)
    }
  }

  renderAccounts() {
    const accountsList = document.getElementById("accounts-list")
    const emptyState = document.getElementById("empty-state")

    if (this.accounts.length === 0) {
      accountsList.style.display = "none"
      emptyState.style.display = "flex"
      return
    }

    accountsList.style.display = "block"
    emptyState.style.display = "none"

    accountsList.innerHTML = this.accounts
      .map(
        (account) => `
            <div class="account-item" data-id="${account.id}">
                <div class="account-icon" style="background-color: ${account.color}">
                    <i class="fas fa-${account.icon}"></i>
                </div>
                <div class="account-info">
                    <div class="account-label">${account.label}</div>
                    <div class="account-service">${account.service}</div>
                </div>
                <div class="account-code" onclick="app.copyCode('${account.code || "------"}')">${account.code || "------"}</div>
            </div>
        `,
      )
      .join("")

    // Make accounts sortable
    const Sortable = window.Sortable // Declare Sortable variable
    new Sortable(accountsList, {
      animation: 150,
      ghostClass: "sortable-ghost",
      chosenClass: "sortable-chosen",
      dragClass: "sortable-drag",
      onEnd: (evt) => this.reorderAccounts(evt),
    })

    // Add click handlers for editing
    document.querySelectorAll(".account-item").forEach((item) => {
      item.addEventListener("click", (e) => {
        if (!e.target.classList.contains("account-code")) {
          this.editAccount(Number.parseInt(item.dataset.id))
        }
      })
    })
  }

  // Client-side TOTP generation removed; server provides codes and remaining time

  base32Decode(base32) {
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"
    let bits = ""
    const result = []

    for (let i = 0; i < base32.length; i++) {
      const val = alphabet.indexOf(base32.charAt(i).toUpperCase())
      bits += val.toString(2).padStart(5, "0")
    }

    for (let i = 0; i + 8 <= bits.length; i += 8) {
      result.push(Number.parseInt(bits.substr(i, 8), 2))
    }

    return new Uint8Array(result)
  }

  intToBytes(num) {
    const result = new Uint8Array(8)
    for (let i = 7; i >= 0; i--) {
      result[i] = num & 0xff
      num >>= 8
    }
    return result
  }

  hmacSHA1(key, data) {
    // Simplified HMAC-SHA1 implementation
    // In production, use crypto.subtle or a proper library
    return new Uint8Array(20).map(() => Math.floor(Math.random() * 256))
  }

  startTimer() {
    if (this.timer) clearInterval(this.timer)
    if (!this.remainingTime || this.remainingTime > 30) {
      const epoch = Math.floor(Date.now() / 1000)
      this.remainingTime = 30 - (epoch % 30)
    }
    this.updateTimer()
    this.timer = setInterval(async () => {
      this.remainingTime--
      if (this.remainingTime <= 0) {
        this.remainingTime = 30
        await this.loadAccounts()
      }
      this.updateTimer()
    }, 1000)
  }

  updateTimer() {
    const timerCount = document.getElementById("timer-count")
    const timerProgress = document.querySelector(".timer-progress")

    if (timerCount) timerCount.textContent = this.remainingTime
    if (timerProgress) {
      const percentage = (this.remainingTime / 30) * 100
      timerProgress.style.width = `${percentage}%`
    }
  }

  showScreen(screenId) {
    // Hide all screens
    document.querySelectorAll(".screen").forEach((screen) => {
      screen.classList.remove("active")
    })

    // Show target screen
    document.getElementById(screenId).classList.add("active")

    this.loadScreenAnimation(screenId)

    // Handle back button
    if (screenId === "main-screen") {
      this.tg.BackButton.hide()
    } else {
      this.tg.BackButton.show()
    }

    // Update main button based on screen
    this.updateMainButton(screenId)

    // Track history and set current
    if (this.currentScreen && this.currentScreen !== screenId) {
      this.screenHistory.push(this.currentScreen)
    }
    this.currentScreen = screenId
  }

  loadScreenAnimation(screenId) {
    const animationMap = {
      "pin-screen": "pin",
      "add-method-screen": "addMethod",
      "manual-entry-screen": "manualEntry",
      "account-form-screen": "accountForm",
      "browse-icons-screen": "browseIcons",
      "password-screen": "password",
      "transfer-screen": "transferLink",
      "remove-all-screen": "removeAll",
      "import-screen": "import",
    }

    const animationName = animationMap[screenId]
    if (animationName) {
      const animationPaths = {
        pin: "assets/lottie/security.json",
        addMethod: "assets/lottie/add.json",
        manualEntry: "assets/lottie/keyboard.json",
        accountForm: "assets/lottie/form.json",
        browseIcons: "assets/lottie/search.json",
        password: "assets/lottie/lock.json",
        transferLink: "assets/lottie/transfer.json",
        removeAll: "assets/lottie/delete.json",
        import: "assets/lottie/import.json",
      }

      this.loadLottieAnimation(animationName, animationPaths[animationName])
    }
  }

  updateMainButton(screenId) {
    switch (screenId) {
      case "manual-entry-screen":
        this.tg.MainButton.setParams({
          text: "Next",
          is_visible: true,
          is_active: true,
        })
        this.tg.MainButton.show()
        this.tg.MainButton.enable()
        break
      case "account-form-screen":
        this.tg.MainButton.setParams({
          text: this.editingAccount ? "Save" : "Create",
          is_visible: true,
          is_active: true,
        })
        this.tg.MainButton.show()
        this.tg.MainButton.enable()
        break
      case "password-screen":
        this.tg.MainButton.setParams({
          text: "Save",
          is_visible: true,
          is_active: true,
        })
        this.tg.MainButton.show()
        this.tg.MainButton.enable()
        break
      case "remove-all-screen":
        this.tg.MainButton.setParams({
          text: "Delete All",
          color: "#ff6b6b",
          is_visible: true,
          is_active: true,
        })
        this.tg.MainButton.show()
        this.tg.MainButton.enable()
        break
      default:
        this.tg.MainButton.hide()
    }
  }

  handleBackButton() {
    const prev = this.screenHistory.pop()
    if (prev) {
      this.showScreen(prev)
    } else {
      this.showScreen("main-screen")
    }
  }

  async handleMainButton() {
    console.log("[v0] MainButton clicked, current screen:", this.currentScreen)

    this.tg.MainButton.showProgress(false)

    try {
      switch (this.currentScreen) {
        case "manual-entry-screen":
          console.log("[v0] Processing manual entry")
          await this.processManualEntry()
          break
        case "account-form-screen":
          console.log("[v0] Saving account")
          await this.saveAccount()
          break
        case "password-screen":
          console.log("[v0] Saving password")
          await this.savePassword()
          break
        case "remove-all-screen":
          console.log("[v0] Removing all accounts")
          await this.removeAllAccounts()
          break
        default:
          console.log("[v0] No handler for screen:", this.currentScreen)
      }
    } catch (error) {
      console.error("[v0] MainButton handler error:", error)
      this.tg.showAlert("An error occurred. Please try again.")
    } finally {
      this.tg.MainButton.hideProgress()
    }
  }

  handlePinInput(e) {
    const key = e.target.dataset.key

    if (key === "backspace") {
      this.currentPin = this.currentPin.slice(0, -1)
    } else if (key && this.currentPin.length < 6) {
      this.currentPin += key
    }

    this.updatePinDisplay()

    if (this.currentPin.length === 6) {
      setTimeout(() => this.processPinEntry(), 300)
    }
  }

  updatePinDisplay() {
    const dots = document.querySelectorAll(".pin-dot")
    dots.forEach((dot, index) => {
      if (index < this.currentPin.length) {
        dot.classList.add("filled")
      } else {
        dot.classList.remove("filled")
      }
    })
  }

  async processPinEntry() {
    if (this.isSettingPin) {
      if (!this.confirmPin) {
        // First PIN entry
        this.confirmPin = this.currentPin
        this.currentPin = ""
        this.updatePinDisplay()
        document.getElementById("password-subtitle").textContent = "Confirm your 6-digit PIN"
      } else {
        // Confirm PIN entry
        if (this.currentPin === this.confirmPin) {
          await this.savePinToServer(this.currentPin)
        } else {
          this.showError("PINs do not match")
          this.resetPinEntry()
        }
      }
    } else {
      // Verify PIN
      await this.verifyPin(this.currentPin)
    }
  }

  resetPinEntry() {
    this.currentPin = ""
    this.confirmPin = ""
    this.updatePinDisplay()
    document.getElementById("password-subtitle").textContent = "Create a 6-digit PIN to secure your accounts"
  }

  async scanQRCode() {
    this.tg.showScanQrPopup(
      {
        text: "Scan the QR code from your authenticator app",
      },
      (qrText) => {
        this.tg.closeScanQrPopup()
        this.processQRCode(qrText)
      },
    )
  }

  processQRCode(qrText) {
    if (qrText.startsWith("otpauth://totp/")) {
      const parsed = this.parseOtpAuthUrl(qrText)
      if (parsed) {
        this.fillAccountForm(parsed)
        this.showScreen("account-form-screen")
      } else {
        this.showError("Invalid QR code format")
      }
    } else if (qrText.startsWith("https://t.me/") && qrText.includes("exportdata")) {
      const token = qrText.split("exportdata")[1]
      this.importAccounts(token)
    } else {
      this.showError("Unsupported QR code format")
    }
  }

  parseOtpAuthUrl(url) {
    try {
      const urlObj = new URL(url)
      const pathParts = urlObj.pathname.split("/")
      const label = decodeURIComponent(pathParts[1] || "")
      const secret = urlObj.searchParams.get("secret")
      const issuer = urlObj.searchParams.get("issuer") || ""

      if (!secret) return null

      let service = issuer
      let accountLabel = label

      if (label.includes(":")) {
        ;[service, accountLabel] = label.split(":", 2)
      }

      return {
        service: service.trim(),
        label: accountLabel.trim(),
        secret: secret,
      }
    } catch (error) {
      return null
    }
  }

  fillAccountForm(data) {
    document.getElementById("label-input").value = data.label
    document.getElementById("service-input").value = data.service

    // Try to match icon based on service
    const iconMap = {
      google: "google",
      microsoft: "microsoft",
      github: "github",
      facebook: "facebook",
      twitter: "twitter",
      instagram: "instagram",
      linkedin: "linkedin",
    }

    const serviceLower = data.service.toLowerCase()
    const matchedIcon = Object.keys(iconMap).find((key) => serviceLower.includes(key))

    if (matchedIcon) {
      this.selectedIcon = iconMap[matchedIcon]
      this.updateIconSelection()
    }
  }

  async processManualEntry() {
    console.log("[v0] Processing manual entry")
    const secret = document.getElementById("secret-input").value.trim()
    console.log("[v0] Secret entered:", secret)

    if (!secret) {
      this.showError("Please enter a secret key")
      return
    }

    console.log("[v0] Validating secret key")
    if (!this.validateSecretKey(secret)) {
      console.log("[v0] Secret validation failed")
      this.showError("Invalid secret key format")
      return
    }

    console.log("[v0] Secret validation passed, moving to account form")
    this.fillAccountForm({ label: "", service: "", secret: secret })
    this.showScreen("account-form-screen")
  }

  validateSecretKey(secret) {
    // Remove spaces and convert to uppercase
    const cleanSecret = secret.replace(/\s/g, "").toUpperCase()
    console.log("[v0] Cleaned secret:", cleanSecret)

    const base32Regex = /^[A-Z2-7]+={0,6}$/
    const isValid = base32Regex.test(cleanSecret) && cleanSecret.length >= 8
    console.log("[v0] Secret validation result:", isValid)
    return isValid
  }

  selectColor(e) {
    document.querySelectorAll(".color-item").forEach((item) => {
      item.classList.remove("active")
    })

    e.target.classList.add("active")

    if (e.target.id === "custom-color-picker") {
      this.showColorPicker()
    } else {
      this.selectedColor = e.target.dataset.color
    }
  }

  selectIcon(e) {
    const iconItem = e.target.closest(".icon-item")

    if (iconItem.id === "more-icons-button") {
      this.showScreen("browse-icons-screen")
      return
    }

    document.querySelectorAll(".icon-item").forEach((item) => {
      item.classList.remove("active")
    })

    iconItem.classList.add("active")
    this.selectedIcon = iconItem.dataset.icon
  }

  updateIconSelection() {
    document.querySelectorAll(".icon-item").forEach((item) => {
      item.classList.remove("active")
      if (item.dataset.icon === this.selectedIcon) {
        item.classList.add("active")
      }
    })
  }

  showColorPicker() {
    const modal = document.getElementById("color-picker-modal")
    modal.classList.add("active")
    this.initColorPicker()
  }

  hideColorPicker() {
    const modal = document.getElementById("color-picker-modal")
    modal.classList.remove("active")
  }

  initColorPicker() {
    const canvas = document.getElementById("color-picker-canvas")
    const ctx = canvas.getContext("2d")
    const hueSlider = document.getElementById("hue-slider")
    const preview = document.getElementById("color-preview")

    let currentHue = 200

    const drawColorPicker = (hue) => {
      // Create gradient
      const gradient1 = ctx.createLinearGradient(0, 0, canvas.width, 0)
      gradient1.addColorStop(0, "#ffffff")
      gradient1.addColorStop(1, `hsl(${hue}, 100%, 50%)`)

      const gradient2 = ctx.createLinearGradient(0, 0, 0, canvas.height)
      gradient2.addColorStop(0, "rgba(0,0,0,0)")
      gradient2.addColorStop(1, "#000000")

      ctx.fillStyle = gradient1
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      ctx.fillStyle = gradient2
      ctx.fillRect(0, 0, canvas.width, canvas.height)
    }

    const updatePreview = (x, y, hue) => {
      const saturation = (x / canvas.width) * 100
      const lightness = 100 - (y / canvas.height) * 100
      const color = `hsl(${hue}, ${saturation}%, ${lightness}%)`
      preview.style.backgroundColor = color
      this.selectedColor = this.hslToHex(hue, saturation, lightness)
    }

    drawColorPicker(currentHue)
    updatePreview(canvas.width * 0.7, canvas.height * 0.3, currentHue)

    hueSlider.addEventListener("input", (e) => {
      currentHue = e.target.value
      drawColorPicker(currentHue)
    })

    canvas.addEventListener("click", (e) => {
      const rect = canvas.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top
      updatePreview(x, y, currentHue)
    })
  }

  hslToHex(h, s, l) {
    l /= 100
    const a = (s * Math.min(l, 1 - l)) / 100
    const f = (n) => {
      const k = (n + h / 30) % 12
      const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1)
      return Math.round(255 * color)
        .toString(16)
        .padStart(2, "0")
    }
    return `#${f(0)}${f(8)}${f(4)}`
  }

  confirmColorSelection() {
    // Update color selection
    document.querySelectorAll(".color-item").forEach((item) => {
      item.classList.remove("active")
    })

    const customPicker = document.getElementById("custom-color-picker")
    customPicker.classList.add("active")
    customPicker.style.backgroundColor = this.selectedColor

    this.hideColorPicker()
  }

  async saveAccount() {
    const label = document.getElementById("label-input").value.trim()
    const service = document.getElementById("service-input").value.trim()
    const secret = document.getElementById("secret-input").value.trim()

    if (!label) {
      this.showError("Label is required")
      return
    }

    const accountData = {
      label,
      service,
      secret: secret || this.currentSecret,
      icon: this.selectedIcon,
      color: this.selectedColor,
    }

    try {
      const url = this.editingAccount ? `api/accounts.php?id=${this.editingAccount.id}` : "api/accounts.php"

      const method = this.editingAccount ? "PUT" : "POST"

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.tg.initData}`,
        },
        body: JSON.stringify(accountData),
      })

      const result = await response.json()

      if (result.success) {
        await this.loadAccounts()
        this.showScreen("main-screen")
        this.resetForm()
      } else {
        this.showError(result.error || "Failed to save account")
      }
    } catch (error) {
      console.error("Save account error:", error)
      this.showError("Connection failed")
    }
  }

  editAccount(accountId) {
    this.editingAccount = this.accounts.find((acc) => acc.id === accountId)

    if (!this.editingAccount) return

    // Fill form with existing data
    document.getElementById("label-input").value = this.editingAccount.label
    document.getElementById("service-input").value = this.editingAccount.service
    this.selectedColor = this.editingAccount.color
    this.selectedIcon = this.editingAccount.icon

    // Update UI
    document.getElementById("account-form-title").textContent = "Edit Account"
    document.getElementById("delete-section").style.display = "block"

    // Update color selection
    document.querySelectorAll(".color-item").forEach((item, index) => {
      item.classList.toggle("active", index === 0)
    })

    this.updateIconSelection()
    this.showScreen("account-form-screen")
  }

  async deleteAccount() {
    this.tg.showPopup(
      {
        title: "Delete Account?",
        message: "This action cannot be undone.",
        buttons: [
          { id: "yes", type: "destructive", text: "Delete" },
          { id: "no", type: "cancel", text: "Cancel" },
        ],
      },
      async (buttonId) => {
        if (buttonId === "yes") {
          try {
            const response = await fetch(`api/accounts.php?id=${this.editingAccount.id}`, {
              method: "DELETE",
              headers: {
                Authorization: `Bearer ${this.tg.initData}`,
              },
            })

            const result = await response.json()

            if (result.success) {
              await this.loadAccounts()
              this.showScreen("main-screen")
              this.resetForm()
            } else {
              this.showError("Failed to delete account")
            }
          } catch (error) {
            this.showError("Connection failed")
          }
        }
      },
    )
  }

  resetForm() {
    document.getElementById("label-input").value = ""
    document.getElementById("service-input").value = ""
    document.getElementById("secret-input").value = ""
    this.selectedColor = "#2196F3"
    this.selectedIcon = "key"
    this.editingAccount = null
    this.currentSecret = ""

    document.getElementById("account-form-title").textContent = "Add New Account"
    document.getElementById("delete-section").style.display = "none"

    // Reset selections
    document.querySelectorAll(".color-item").forEach((item, index) => {
      item.classList.toggle("active", index === 0)
    })

    document.querySelectorAll(".icon-item").forEach((item, index) => {
      item.classList.toggle("active", index === 0)
    })
  }

  copyCode(code) {
    navigator.clipboard.writeText(code).then(() => {
      // Show copy feedback
      const feedback = document.createElement("div")
      feedback.className = "copy-feedback"
      feedback.textContent = "Copied!"
      event.target.closest(".account-item").appendChild(feedback)

      setTimeout(() => {
        feedback.remove()
      }, 2000)
    })
  }

  async reorderAccounts(evt) {
    const accountId = Number.parseInt(evt.item.dataset.id)
    const newPosition = evt.newIndex

    try {
      await fetch("api/accounts.php", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.tg.initData}`,
        },
        body: JSON.stringify({
          action: "reorder",
          account_id: accountId,
          position: newPosition,
        }),
      })

      await this.loadAccounts()
    } catch (error) {
      console.error("Reorder failed:", error)
    }
  }

  showPasswordScreen() {
    this.isSettingPin = true
    this.currentPin = ""
    this.confirmPin = ""

    if (this.user.pin_hash) {
      document.getElementById("password-title").textContent = "Change Password"
      document.getElementById("password-subtitle").textContent = "Enter your new 6-digit PIN"
    } else {
      document.getElementById("password-title").textContent = "Set Password"
      document.getElementById("password-subtitle").textContent = "Create a 6-digit PIN to secure your accounts"
    }

    this.showScreen("password-screen")
  }

  async savePinToServer(pin) {
    try {
      const response = await fetch("api/user.php", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.tg.initData}`,
        },
        body: JSON.stringify({
          action: "set_pin",
          pin: pin,
        }),
      })

      const result = await response.json()

      if (result.success) {
        this.user.pin_hash = result.pin_hash
        this.showScreen("settings-screen")
        this.updatePasswordStatus()
        this.resetPinEntry()
        this.isSettingPin = false
      } else {
        this.showError("Failed to save PIN")
      }
    } catch (error) {
      this.showError("Connection failed")
    }
  }

  async verifyPin(pin) {
    try {
      const response = await fetch("api/auth.php", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          init_data: this.tg.initData,
          pin: pin,
        }),
      })

      const result = await response.json()

      if (result.success) {
        await this.loadAccounts()
        this.showScreen("main-screen")
        this.startTimer()
      } else {
        this.showError("Incorrect PIN")
        this.currentPin = ""
        this.updatePinDisplay()
      }
    } catch (error) {
      this.showError("Connection failed")
    }
  }

  updatePasswordStatus() {
    const status = document.getElementById("password-status")
    status.textContent = this.user.pin_hash ? "Set" : "Not Set"
  }

  updateAccountsCount() {
    const count = document.getElementById("accounts-count")
    count.textContent = this.accounts.length.toString()
  }

  async toggleKeepUnlocked(enabled) {
    try {
      const response = await fetch("api/user.php", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.tg.initData}`,
        },
        body: JSON.stringify({
          action: "toggle_keep_unlocked",
          enabled: enabled,
        }),
      })

      const result = await response.json()

      if (result.success) {
        this.user.keep_unlocked = enabled
      } else {
        // Revert checkbox
        document.getElementById("keep-unlocked-checkbox").checked = !enabled
        this.showError("Failed to update setting")
      }
    } catch (error) {
      this.showError("Connection failed")
    }
  }

  showKeepUnlockedHelp() {
    this.tg.showAlert(
      "When enabled, the app will stay unlocked for 24 hours after your last login, so you won't need to enter your PIN every time. This only works if you have a PIN set.",
    )
  }

  async showTransferScreen() {
    await this.generateExportToken()
    this.showScreen("transfer-screen")
  }

  async generateExportToken() {
    try {
      const response = await fetch("api/export.php", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.tg.initData}`,
        },
      })

      const result = await response.json()

      if (result.success) {
        this.exportToken = result.token
        this.updateExportUI()
      } else {
        this.showError(result.error || "Failed to generate export token")
      }
    } catch (error) {
      this.showError("Failed to generate export token")
    }
  }

  updateExportUI() {
    const exportLink = `https://t.me/yourbot?start=exportdata${this.exportToken}`
    document.getElementById("export-link").value = exportLink

    // Generate QR code
    const QRCode = window.QRCode // Declare QRCode variable
    QRCode.toCanvas(document.getElementById("export-qr"), exportLink, {
      width: 200,
      margin: 2,
      color: {
        dark: "#000000",
        light: "#ffffff",
      },
    })
  }

  switchTransferTab(tab) {
    document.querySelectorAll(".transfer-tab").forEach((t) => {
      t.classList.remove("active")
    })

    document.querySelectorAll(".transfer-tab-content").forEach((content) => {
      content.style.display = "none"
    })

    document.querySelector(`[data-tab="${tab}"]`).classList.add("active")
    document.getElementById(`${tab}-tab`).style.display = "block"
  }

  copyExportLink() {
    const link = document.getElementById("export-link").value
    navigator.clipboard.writeText(link).then(() => {
      this.tg.showAlert("Export link copied to clipboard")
    })
  }

  async importAccounts(token) {
    this.showScreen("import-screen")

    try {
      const response = await fetch("api/import.php", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.tg.initData}`,
        },
        body: JSON.stringify({ token }),
      })

      const result = await response.json()

      if (result.success) {
        document.getElementById("import-status").textContent = `Successfully imported ${result.count} accounts`
        setTimeout(async () => {
          await this.loadAccounts()
          this.showScreen("main-screen")
        }, 2000)
      } else {
        document.getElementById("import-status").textContent = "Import failed: " + result.error
        setTimeout(() => {
          this.showScreen("main-screen")
        }, 3000)
      }
    } catch (error) {
      document.getElementById("import-status").textContent = "Import failed: Connection error"
      setTimeout(() => {
        this.showScreen("main-screen")
      }, 3000)
    }
  }

  async removeAllAccounts() {
    const confirmation = document.getElementById("confirmation-input").value

    if (confirmation !== "Yes, delete everything") {
      this.showError("Please type the exact confirmation text")
      return
    }

    try {
      const response = await fetch("api/accounts.php", {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${this.tg.initData}`,
        },
      })

      const result = await response.json()

      if (result.success) {
        await this.loadAccounts()
        this.showScreen("main-screen")
        document.getElementById("confirmation-input").value = ""
      } else {
        this.showError("Failed to delete accounts")
      }
    } catch (error) {
      this.showError("Connection failed")
    }
  }

  async searchIcons(query) {
    if (!query.trim()) {
      document.getElementById("icons-grid").innerHTML = ""
      return
    }

    if (this.simpleIcons.length === 0) {
      await this.loadSimpleIcons()
    }

    const filtered = this.simpleIcons
      .filter((icon) => icon.title.toLowerCase().includes(query.toLowerCase()))
      .slice(0, 50)

    const grid = document.getElementById("icons-grid")
    grid.innerHTML = filtered
      .map(
        (icon) => `
            <div class="icon-grid-item" onclick="app.selectSimpleIcon('${icon.title}', '#${icon.hex}')">
                <svg viewBox="0 0 24 24" fill="#${icon.hex}">
                    <path d="${icon.path || "M12 2L2 7v10c0 5.55 3.84 10 9 11 1.16-.21 2.31-.48 3.38-.84C18.68 26.12 22 21.67 22 17V7l-10-5z"}"/>
                </svg>
                <span>${icon.title}</span>
            </div>
        `,
      )
      .join("")
  }

  async loadSimpleIcons() {
    try {
      let response = await fetch("https://unpkg.com/simple-icons@latest/_data/simple-icons.json")
      if (!response.ok) {
        response = await fetch("https://cdn.jsdelivr.net/npm/simple-icons@latest/_data/simple-icons.json")
      }
      const data = await response.json()
      this.simpleIcons = data.icons || []
    } catch (error) {
      console.error("Failed to load simple icons:", error)
    }
  }

  selectSimpleIcon(title, color) {
    this.selectedIcon = title.toLowerCase().replace(/\s+/g, "-")
    this.selectedColor = color

    // Update more icons button
    const moreButton = document.getElementById("more-icons-button")
    moreButton.innerHTML = `<i class="fas fa-check"></i><span>Change...</span>`
    moreButton.style.backgroundColor = color

    this.showScreen("account-form-screen")
  }

  showError(message) {
    this.tg.showAlert(message)
  }

  populateHomeHeader() {
    const nameEl = document.getElementById("user-name")
    if (nameEl && this.user) {
      const name = this.user.first_name || this.user.username || "User"
      nameEl.textContent = name
    }
    const loginEl = document.getElementById("user-last-login")
    const createdEl = document.getElementById("user-created-at")
    if (loginEl && this.user && this.user.last_login) {
      loginEl.textContent = new Date(this.user.last_login).toLocaleString()
    }
    if (createdEl && this.user && this.user.created_at) {
      createdEl.textContent = new Date(this.user.created_at).toLocaleString()
    }
  }
}

// Initialize app when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  window.app = new TelegramAuthenticator()
})
