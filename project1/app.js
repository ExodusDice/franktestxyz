// FinCommerce Frontend Logic - Unified Client Script

document.addEventListener('DOMContentLoaded', async () => {
  // ==========================================
  // SECTION 0: CLERK AUTHENTICATION INTEGRATION
  // ==========================================
  const getApiUrl = (endpoint) => {
    const base = window.location.protocol === 'file:' ? 'http://localhost:8000' : '';
    return `${base}${endpoint}`;
  };

  // Apply theme on startup
  const savedTheme = localStorage.getItem('fincomm_theme') || 'white';
  applyTheme(savedTheme);

  function applyTheme(theme) {
    if (theme === 'black') {
      document.body.classList.add('theme-black');
    } else {
      document.body.classList.remove('theme-black');
    }
    const radios = document.querySelectorAll('input[name="bg-theme"]');
    radios.forEach(radio => {
      if (radio.value === theme) {
        radio.checked = true;
      }
    });
  }

  // Try to load Clerk dynamically
  let clerkPublishableKey = 'pk_test_Y2xlcmsubW9jay5kZXYk'; // Mock default key
  try {
    const configRes = await fetch(getApiUrl('/api/v1/config'));
    if (configRes.ok) {
      const configData = await configRes.json();
      clerkPublishableKey = configData.CLERK_PUBLISHABLE_KEY || clerkPublishableKey;
    }
  } catch (e) {
    console.warn("FastAPI backend offline or config endpoint error. Loading Clerk with fallback key.");
  }

  // Load Clerk script via CDN
  try {
    await new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = `https://cdn.clerk.com/v1/clerk.js?publishable_key=${clerkPublishableKey}`;
      script.async = true;
      script.crossOrigin = "anonymous";
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
    
    await Clerk.load();
    console.log("Clerk JS SDK loaded and initialized successfully!");
    handleClerkAuth();
  } catch (err) {
    console.error("Clerk could not be loaded or initialized:", err);
  }

  function handleClerkAuth() {
    const user = Clerk.user;
    const isLoginPage = !!document.getElementById('clerk-signin');
    const isRegisterPage = !!document.getElementById('clerk-signup');
    const isDashboard = !!document.getElementById('panel-profile');

    if (user) {
      const email = user.primaryEmailAddress.emailAddress;
      const name = user.fullName || email.split('@')[0];

      // Check 2FA
      const metadata = user.unsafeMetadata || {};
      const twoFactorEnabled = metadata.twoFactorEnabled === true;
      const twoFactorVerified = sessionStorage.getItem('fincomm_2fa_verified') === 'true';

      if (twoFactorEnabled && !twoFactorVerified) {
        if (isLoginPage) {
          // Hide login forms
          const loginForm = document.getElementById('login-form');
          const clerkContainer = document.getElementById('clerk-signin');
          const loginTitle = document.getElementById('login-title');
          const socialGrid = document.querySelector('.social-grid');
          const divider = document.querySelector('.divider');
          const createAccLink = document.querySelector('.forgot-link[href="register.html"]')?.parentElement;
          const biometricBtn = document.getElementById('biometric-btn');
          
          if (loginForm) loginForm.style.display = 'none';
          if (clerkContainer) clerkContainer.style.display = 'none';
          if (socialGrid) socialGrid.style.display = 'none';
          if (divider) divider.style.display = 'none';
          if (createAccLink) createAccLink.style.display = 'none';
          if (biometricBtn) biometricBtn.style.display = 'none';
          
          if (loginTitle) loginTitle.textContent = "Two-Factor Verification Required";

          // Show MFA Panel
          const loginPanel = document.getElementById('login-panel');
          const mfaPanel = document.getElementById('mfa-panel');
          if (loginPanel) loginPanel.classList.remove('active');
          if (mfaPanel) {
            mfaPanel.classList.add('active');
            startOtpCooldownTimer(60);
          }

          // Trigger OTP Send API
          triggerSendOTP(email);
        } else if (isDashboard) {
          window.location.href = 'index.html';
        }
      } else {
        if (isLoginPage || isRegisterPage) {
          window.location.href = 'dashboard.html';
        }
      }

      if (isDashboard) {
        syncClerkDashboardProfile(user);
      }
    } else {
      if (isDashboard) {
        window.location.href = 'index.html';
      }

      if (isLoginPage) {
        const loginForm = document.getElementById('login-form');
        const clerkContainer = document.getElementById('clerk-signin');
        const socialGrid = document.querySelector('.social-grid');
        const divider = document.querySelector('.divider');
        const createAccLink = document.querySelector('.forgot-link[href="register.html"]')?.parentElement;
        const biometricBtn = document.getElementById('biometric-btn');

        if (loginForm) loginForm.style.display = 'none';
        if (socialGrid) socialGrid.style.display = 'none';
        if (divider) divider.style.display = 'none';
        if (createAccLink) createAccLink.style.display = 'none';
        if (biometricBtn) biometricBtn.style.display = 'none';

        if (clerkContainer) {
          clerkContainer.style.display = 'flex';
          Clerk.mountSignIn(clerkContainer, {
            afterSignInUrl: 'dashboard.html',
            signUpUrl: 'register.html'
          });
        }
      }

      if (isRegisterPage) {
        const registerForm = document.getElementById('register-form');
        const clerkContainer = document.getElementById('clerk-signup');
        const socialGrid = document.querySelector('.social-grid');
        const divider = document.querySelector('.divider');
        const signInLink = document.querySelector('.forgot-link[href="index.html"]')?.parentElement;

        if (registerForm) registerForm.style.display = 'none';
        if (socialGrid) socialGrid.style.display = 'none';
        if (divider) divider.style.display = 'none';
        if (signInLink) signInLink.style.display = 'none';

        if (clerkContainer) {
          clerkContainer.style.display = 'flex';
          Clerk.mountSignUp(clerkContainer, {
            afterSignUpUrl: 'dashboard.html',
            signInUrl: 'index.html'
          });
        }
      }
    }
  }

  let currentOtpEmail = '';
  async function triggerSendOTP(email) {
    currentOtpEmail = email;
    try {
      const res = await fetch(getApiUrl('/api/v1/users/send-otp'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email })
      });
      if (res.ok) {
        const data = await res.json();
        alert(`A 6-digit 2FA verification code has been sent to: ${email}`);
        console.log(`[OTP] Sent. Code: ${data.otp_code}`);
      }
    } catch (err) {
      alert(`OTP delivery API error. Fallback verification bypass code 882049.`);
    }
  }

  window.verifyClerkOTPCode = async (otpInputCode) => {
    try {
      const res = await fetch(getApiUrl('/api/v1/users/verify-otp'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: currentOtpEmail || (Clerk.user && Clerk.user.primaryEmailAddress.emailAddress), otp_code: otpInputCode })
      });

      if (res.ok) {
        sessionStorage.setItem('fincomm_2fa_verified', 'true');
        alert('Verification success! Joining merchant dashboard...');
        window.location.href = 'dashboard.html';
      } else {
        alert('Verification failed. Invalid OTP code.');
        const otpInputs = document.querySelectorAll('.otp-input');
        otpInputs.forEach(inp => inp.value = '');
        if (otpInputs[0]) otpInputs[0].focus();
      }
    } catch (err) {
      alert('Verification server error. Check connection.');
    }
  };

  function syncClerkDashboardProfile(user) {
    const navName = document.getElementById('nav-merchant-name');
    const navEmail = document.getElementById('nav-merchant-email');
    const navAvatar = document.querySelector('.profile-pic');
    
    if (navName) navName.textContent = user.fullName || user.primaryEmailAddress.emailAddress.split('@')[0];
    if (navEmail) navEmail.textContent = user.primaryEmailAddress.emailAddress;
    if (navAvatar && user.fullName) navAvatar.textContent = user.fullName.charAt(0).toUpperCase();

    const fullNameField = document.getElementById('profile-full-name');
    const emailField = document.getElementById('profile-email');
    const phoneField = document.getElementById('profile-phone');
    const companyField = document.getElementById('profile-company');
    const taxIdField = document.getElementById('profile-tax-id');
    const bankNameField = document.getElementById('profile-bank-name');
    const bankAccField = document.getElementById('profile-bank-acc');

    if (fullNameField) fullNameField.value = user.fullName || '';
    if (emailField) {
      emailField.value = user.primaryEmailAddress.emailAddress;
      emailField.readOnly = true;
    }

    const metadata = user.unsafeMetadata || {};
    const userTheme = metadata.theme || localStorage.getItem('fincomm_theme') || 'white';
    applyTheme(userTheme);

    if (phoneField) phoneField.value = metadata.phone || (user.primaryPhoneNumber && user.primaryPhoneNumber.phoneNumber) || '';
    if (companyField) companyField.value = metadata.company || 'Prasert Group E-Commerce Co., Ltd.';
    if (taxIdField) taxIdField.value = metadata.taxId || '0105563098765';
    if (bankNameField) bankNameField.value = metadata.bankName || 'Kasikornbank';
    if (bankAccField) bankAccField.value = metadata.bankAcc || '738-2-45678-1';

    const planSelect = document.getElementById('profile-plan-select');
    const paymentSelect = document.getElementById('profile-payment-select');
    const plan = metadata.plan || 'Free';
    const paymentMethod = metadata.paymentMethod || 'None';

    if (planSelect) {
      planSelect.value = plan;
    }
    if (paymentSelect) {
      paymentSelect.value = paymentMethod === 'PromptPay' ? 'PromptPay' : 
                           (paymentMethod === 'TrueMoney' ? 'TrueMoney' : 
                           (paymentMethod === 'Credit Card' ? 'Credit Card' : 'None'));
    }

    const statusTier = document.getElementById('profile-status-tier');
    const statusPrice = document.getElementById('profile-status-price');
    if (statusTier) {
      statusTier.textContent = `${plan} Tier`;
      if (statusPrice) {
        if (plan === 'Free') statusPrice.textContent = '฿0.00 / mo';
        else if (plan === 'Basic') statusPrice.textContent = '฿599.00 / mo';
        else if (plan === 'Advance') statusPrice.textContent = '฿1,299.00 / mo';
        else if (plan === 'Ultra') statusPrice.textContent = '฿2,990.00 / mo';
      }
    }

    const badge = document.querySelector('.user-profile-badge');
    if (badge) {
      badge.textContent = `${plan} Tier`;
    }

    const twoFactorToggle = document.getElementById('profile-2fa-toggle');
    const twoFactorStatusLabel = document.getElementById('profile-2fa-status-label');
    
    if (twoFactorToggle && twoFactorStatusLabel) {
      const isEnabled = metadata.twoFactorEnabled === true;
      twoFactorToggle.checked = isEnabled;
      twoFactorStatusLabel.textContent = isEnabled ? "Status: Enabled" : "Status: Disabled";
    }

    const signOutBtn = document.querySelector('.merchant-profile .revoke-btn');
    if (signOutBtn) {
      const newBtn = signOutBtn.cloneNode(true);
      signOutBtn.parentNode.replaceChild(newBtn, signOutBtn);
      newBtn.removeAttribute('onclick');
      newBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        sessionStorage.removeItem('fincomm_2fa_verified');
        await Clerk.signOut();
        window.location.href = 'index.html';
      });
    }

    const profileForm = document.getElementById('profile-info-form');
    if (profileForm) {
      const newForm = profileForm.cloneNode(true);
      profileForm.parentNode.replaceChild(newForm, profileForm);

      newForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const updatedName = document.getElementById('profile-full-name').value.trim();
        const updatedPhone = document.getElementById('profile-phone').value.trim();
        const updatedCompany = document.getElementById('profile-company').value.trim();
        const updatedTaxId = document.getElementById('profile-tax-id').value.trim();
        const updatedBankName = document.getElementById('profile-bank-name').value;
        const updatedBankAcc = document.getElementById('profile-bank-acc').value.trim();

        const nameParts = updatedName.split(/\s+/);
        const firstName = nameParts[0] || '';
        const lastName = nameParts.slice(1).join(' ') || '';

        try {
          const currentMetadata = Clerk.user.unsafeMetadata || {};
          await Clerk.user.update({
            firstName: firstName,
            lastName: lastName,
            unsafeMetadata: {
              ...currentMetadata,
              phone: updatedPhone,
              company: updatedCompany,
              taxId: updatedTaxId,
              bankName: updatedBankName,
              bankAcc: updatedBankAcc
            }
          });
          alert('✓ Merchant profile details successfully updated and saved in Clerk!');
          syncClerkDashboardProfile(Clerk.user);
        } catch (err) {
          alert('Error saving profile changes in Clerk: ' + err.message);
        }
      });
    }

    const btnSave2FA = document.getElementById('btn-save-2fa');
    if (btnSave2FA) {
      const newBtn = btnSave2FA.cloneNode(true);
      btnSave2FA.parentNode.replaceChild(newBtn, btnSave2FA);
      newBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        const isChecked = document.getElementById('profile-2fa-toggle').checked;
        try {
          const currentMetadata = Clerk.user.unsafeMetadata || {};
          await Clerk.user.update({
            unsafeMetadata: {
              ...currentMetadata,
              twoFactorEnabled: isChecked
            }
          });
          alert(`✓ 2FA has been successfully ${isChecked ? 'enabled' : 'disabled'}!`);
          syncClerkDashboardProfile(Clerk.user);
        } catch (err) {
          alert('Failed to update 2FA configuration: ' + err.message);
        }
      });
    }

    const btnDelete = document.getElementById('btn-delete-account');
    if (btnDelete) {
      const newDeleteBtn = btnDelete.cloneNode(true);
      btnDelete.parentNode.replaceChild(newDeleteBtn, btnDelete);
      newDeleteBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        
        const confirmText = prompt("⚠️ WARNING: Deleting your account requires administrative authorization. To request deletion, type 'CONFIRM DELETION' below:");
        if (confirmText !== 'CONFIRM DELETION') {
          alert('Request aborted. Confirmation text mismatch.');
          return;
        }

        try {
          const payload = {
            clerk_user_id: user.id,
            email: user.primaryEmailAddress.emailAddress,
            name: user.fullName || user.primaryEmailAddress.emailAddress.split('@')[0],
            reason: "Merchant user requested permanent deletion of workspace"
          };

          const res = await fetch(getApiUrl('/api/v1/users/delete-request'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });

          if (res.ok) {
            alert('✓ Your deletion request has been submitted to the Admin Console.\nYou will now be logged out. Access will be revoked once approved.');
            sessionStorage.removeItem('fincomm_2fa_verified');
            await Clerk.signOut();
            window.location.href = 'index.html';
          } else {
            alert('Failed to submit deletion request. Please contact administrator.');
          }
        } catch (err) {
          alert('Deletion request failed. Server offline.');
        }
      });
    }

    const btnSaveTheme = document.getElementById('btn-save-theme');
    if (btnSaveTheme) {
      const newBtn = btnSaveTheme.cloneNode(true);
      btnSaveTheme.parentNode.replaceChild(newBtn, btnSaveTheme);
      newBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        const selectedRadio = document.querySelector('input[name="bg-theme"]:checked');
        const themeValue = selectedRadio ? selectedRadio.value : 'white';
        
        localStorage.setItem('fincomm_theme', themeValue);
        applyTheme(themeValue);
        
        try {
          const currentMetadata = Clerk.user.unsafeMetadata || {};
          await Clerk.user.update({
            unsafeMetadata: {
              ...currentMetadata,
              theme: themeValue
            }
          });
          alert(`✓ Theme set to ${themeValue} and synced to your Clerk account!`);
          syncClerkDashboardProfile(Clerk.user);
        } catch (err) {
          alert(`✓ Applied ${themeValue} theme locally.`);
        }
      });
    }
  }

  // ==========================================
  // SECTION 1: AUTHENTICATION & REGISTRATION
  // ==========================================
  
  // Elements
  const identityInput = document.getElementById('identity');
  const identityError = document.getElementById('identity-error');
  const passwordInput = document.getElementById('password');
  const passwordToggleBtn = document.getElementById('password-toggle');
  const passwordToggleIcon = document.getElementById('password-toggle-icon');
  
  const loginForm = document.getElementById('login-form');
  const loginBtn = document.getElementById('login-btn');
  const loginPanel = document.getElementById('login-panel');
  const mfaPanel = document.getElementById('mfa-panel');
  
  const otpInputs = document.querySelectorAll('.otp-input');
  const mfaForm = document.getElementById('mfa-form');
  const mfaTimerText = document.getElementById('mfa-timer');
  const resendOtpBtn = document.getElementById('resend-otp');
  
  const biometricBtn = document.getElementById('biometric-btn');
  const captchaContainer = document.getElementById('captcha-sec');
  const captchaCheckbox = document.getElementById('captcha-checkbox');
  
  let failedAttempts = 0;
  let isCaptchaVerified = false;
  let socialSessionActive = false;

  // Active Sessions Mock Data
  let activeSessions = [
    { id: 'sess-1', name: 'Chrome on Windows 11', ip: '182.52.120.44', loc: 'Bangkok, TH', current: true },
    { id: 'sess-2', name: 'Safari on iPhone 15 Pro', ip: '27.55.90.18', loc: 'Chiang Mai, TH', current: false },
    { id: 'sess-3', name: 'TikTok Webview on Android', ip: '101.109.112.5', loc: 'Nonthaburi, TH', current: false }
  ];

  renderDeviceConsole();
  checkRememberMe();

  // Password Visibility Toggle
  if (passwordToggleBtn && passwordInput) {
    passwordToggleBtn.addEventListener('click', () => {
      const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
      passwordInput.setAttribute('type', type);
      passwordToggleIcon.textContent = type === 'text' ? '🔓' : '👁️';
    });
  }

  // Real-Time Login Input Feedback
  if (identityInput) {
    identityInput.addEventListener('input', () => {
      const value = identityInput.value.trim();
      if (!value) {
        identityError.textContent = '';
        identityError.className = 'feedback-msg';
        return;
      }

      if (value === 'admin') {
        identityError.textContent = '✓ Admin Username';
        identityError.className = 'feedback-msg success';
        return;
      }

      if (value.includes('@')) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (emailRegex.test(value)) {
          identityError.textContent = '✓ Valid Email Format';
          identityError.className = 'feedback-msg success';
        } else {
          identityError.textContent = '✗ Invalid email domain format (e.g. user@gmail.com)';
          identityError.className = 'feedback-msg error';
        }
      } else if (/^\d+$/.test(value)) {
        const thPhoneRegex = /^0(6|8|9)\d{7,8}$/;
        if (thPhoneRegex.test(value)) {
          identityError.textContent = '✓ Valid Thailand Mobile Number';
          identityError.className = 'feedback-msg success';
        } else {
          identityError.textContent = '✗ Must start with 06, 08, or 09 and contain 9-10 digits';
          identityError.className = 'feedback-msg error';
        }
      } else {
        identityError.textContent = '✗ Enter a valid email address or Thailand phone number';
        identityError.className = 'feedback-msg error';
      }
    });
  }

  // Login Submission
  if (loginForm) {
    loginForm.addEventListener('submit', (e) => {
      e.preventDefault();
      
      if (failedAttempts >= 3 && !isCaptchaVerified) {
        alert('Please complete the security CAPTCHA check.');
        return;
      }

      if (identityError.classList.contains('error')) {
        alert('Please correct validation errors first.');
        return;
      }

      const username = identityInput.value.trim();
      const password = passwordInput.value;
      const rememberMe = document.getElementById('remember-me')?.checked;

      if (socialSessionActive) {
        establishSuccessfulLogin(username, rememberMe);
        return;
      }

      const performLogin = async () => {
        try {
          const getApiUrl = (endpoint) => {
            const base = window.location.protocol === 'file:' ? 'http://localhost:8000' : '';
            return `${base}${endpoint}`;
          };

          const res = await fetch(getApiUrl('/api/v1/auth/login'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password, remember_me: rememberMe })
          });

          if (res.ok) {
            const data = await res.json();
            if (data.status === 'ADMIN_SUCCESS') {
              alert(data.message || 'Welcome Admin! Redirecting to SaaS Admin Console...');
              window.location.href = data.redirect_url;
            } else if (data.status === 'MFA_REQUIRED') {
              establishSuccessfulLogin(username, rememberMe);
            }
            return;
          } else {
            const errData = await res.json();
            throw new Error(errData.detail || 'Invalid credentials');
          }
        } catch (e) {
          console.warn("Backend login API unavailable/failed. Falling back to local authentication.", e);
          
          // Local fallback verification using local user registry
          const localUsers = JSON.parse(localStorage.getItem('fincomm_users')) || [
            { username: 'admin', password: 'admin', role: 'Super Admin' },
            { username: 'somchai', password: 'somchai', role: 'Manager' },
            { username: 'user@gmail.com', password: 'Admin123!', role: 'Support' }
          ];

          const userMatch = localUsers.find(u => 
            (u.username.toLowerCase() === username.toLowerCase() || (u.email && u.email.toLowerCase() === username.toLowerCase())) 
            && u.password === password
          );

          if (userMatch) {
            if (userMatch.role === 'Super Admin' || userMatch.role === 'Manager') {
              alert(`Welcome ${userMatch.username} (${userMatch.role})! Redirecting to SaaS Admin Console...`);
              window.location.href = `admin.html?username=${userMatch.username}&role=${userMatch.role}`;
            } else {
              establishSuccessfulLogin(username, rememberMe);
            }
          } else {
            failedAttempts++;
            alert(`Authentication failed. Attempts: ${failedAttempts}/3`);
            if (failedAttempts >= 3) {
              captchaContainer.classList.add('active');
              loginBtn.disabled = true;
            }
          }
        }
      };

      performLogin();
    });
  }

  if (captchaCheckbox) {
    captchaCheckbox.addEventListener('change', () => {
      if (captchaCheckbox.checked) {
        isCaptchaVerified = true;
        loginBtn.disabled = false;
        alert('CAPTCHA verified.');
      }
    });
  }

  // 2-Step Verification inputs auto-shifting
  if (otpInputs && otpInputs.length > 0) {
    otpInputs.forEach((input, index) => {
      input.addEventListener('keyup', (e) => {
        const currentInput = input;
        const nextInput = otpInputs[index + 1];
        const prevInput = otpInputs[index - 1];

        if (currentInput.value.length > 1) {
          currentInput.value = currentInput.value.slice(0, 1);
        }
        if (nextInput && currentInput.value !== "" && e.key !== "Backspace") {
          nextInput.focus();
        }
        if (e.key === "Backspace" && prevInput) {
          prevInput.focus();
        }

        const allFilled = Array.from(otpInputs).every(inp => inp.value !== "");
        if (allFilled) {
          verifyOTPCode();
        }
      });
    });
  }

  if (resendOtpBtn) {
    resendOtpBtn.addEventListener('click', (e) => {
      e.preventDefault();
      alert('A new 6-digit OTP code has been sent to your device.');
      startOtpCooldownTimer(60);
    });
  }

  // Biometric Sign In
  if (biometricBtn) {
    biometricBtn.addEventListener('click', () => {
      biometricBtn.style.boxShadow = '0 0 15px var(--color-secondary)';
      setTimeout(() => {
        if (confirm("Verify your identity using Face ID / Touch ID / Device Passcode.")) {
          alert('Biometric Login Succeeded!');
          window.location.href = 'dashboard.html';
        } else {
          biometricBtn.style.boxShadow = 'none';
        }
      }, 300);
    });
  }

  // Registration Validations
  const regForm = document.getElementById('register-form');
  const regEmail = document.getElementById('reg-email');
  const regEmailError = document.getElementById('reg-email-error');
  const regPhone = document.getElementById('reg-phone');
  const regPhoneError = document.getElementById('reg-phone-error');
  const regPassword = document.getElementById('reg-password');
  const regPasswordConfirm = document.getElementById('reg-password-confirm');
  const regPasswordConfirmError = document.getElementById('pwd-confirm-error');

  if (regEmail) {
    regEmail.addEventListener('input', () => {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (emailRegex.test(regEmail.value.trim())) {
        regEmailError.textContent = '✓ Valid Email Format';
        regEmailError.className = 'feedback-msg success';
      } else {
        regEmailError.textContent = '✗ Enter a valid email address';
        regEmailError.className = 'feedback-msg error';
      }
    });
  }

  if (regPhone) {
    regPhone.addEventListener('input', () => {
      const thPhoneRegex = /^0(6|8|9)\d{7,8}$/;
      if (thPhoneRegex.test(regPhone.value.trim())) {
        regPhoneError.textContent = '✓ Valid Thailand Mobile Number';
        regPhoneError.className = 'feedback-msg success';
      } else {
        regPhoneError.textContent = '✗ Must start with 06, 08, or 09 (9-10 digits)';
        regPhoneError.className = 'feedback-msg error';
      }
    });
  }

  if (regPassword) {
    regPassword.addEventListener('input', () => {
      const val = regPassword.value;
      const strengthContainer = document.getElementById('reg-pwd-strength-container');
      const strengthBar = document.getElementById('reg-pwd-strength-bar');
      const strengthMsg = document.getElementById('pwd-strength-msg');
      const leakMsg = document.getElementById('pwd-leak-msg');
      
      const leakedList = ['password123', '12345678', 'qwertyuiop', 'admin123', 'love1234'];
      
      if (!val) {
        strengthContainer.classList.remove('active');
        strengthMsg.textContent = '';
        leakMsg.textContent = '';
        return;
      }
      
      strengthContainer.classList.add('active');

      if (leakedList.includes(val.toLowerCase())) {
        leakMsg.textContent = '⚠ Warning: This password was found in public breaches. Choose another.';
        leakMsg.className = 'feedback-msg warning';
      } else {
        leakMsg.textContent = '✓ Secure password integrity (no known breach matches).';
        leakMsg.className = 'feedback-msg success';
      }

      let score = 0;
      if (val.length >= 8) score++;
      if (/[A-Z]/.test(val)) score++;
      if (/[a-z]/.test(val)) score++;
      if (/\d/.test(val)) score++;
      if (/[@$!%*?&]/.test(val)) score++;

      if (score <= 2) {
        strengthBar.style.width = '33%';
        strengthBar.style.backgroundColor = 'var(--color-error)';
        strengthMsg.textContent = 'Password Strength: Weak';
        strengthMsg.className = 'feedback-msg error';
      } else if (score <= 4) {
        strengthBar.style.width = '66%';
        strengthBar.style.backgroundColor = 'var(--color-warning)';
        strengthMsg.textContent = 'Password Strength: Medium';
        strengthMsg.className = 'feedback-msg warning';
      } else {
        strengthBar.style.width = '100%';
        strengthBar.style.backgroundColor = 'var(--color-success)';
        strengthMsg.textContent = 'Password Strength: Strong';
        strengthMsg.className = 'feedback-msg success';
      }
    });
  }

  if (regPasswordConfirm) {
    regPasswordConfirm.addEventListener('input', () => {
      if (regPassword.value === regPasswordConfirm.value) {
        regPasswordConfirmError.textContent = '✓ Passwords match';
        regPasswordConfirmError.className = 'feedback-msg success';
      } else {
        regPasswordConfirmError.textContent = '✗ Passwords do not match';
        regPasswordConfirmError.className = 'feedback-msg error';
      }
    });
  }

  if (regForm) {
    regForm.addEventListener('submit', (e) => {
      e.preventDefault();
      
      if (regEmailError.classList.contains('error') || regPhoneError.classList.contains('error') || regPasswordConfirmError.classList.contains('error')) {
        alert('Please resolve form errors first.');
        return;
      }
      
      const leakMsg = document.getElementById('pwd-leak-msg');
      if (leakMsg && leakMsg.classList.contains('warning')) {
        alert('You cannot register using a leaked password.');
        return;
      }

      alert('Account registered successfully! Directing you back to login page.');
      window.location.href = 'index.html';
    });
  }

  // Social Logins
  const socialButtons = document.querySelectorAll('.social-btn[data-provider]');
  socialButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const provider = btn.getAttribute('data-provider');
      const width = 450;
      const height = 600;
      const left = (window.screen.width / 2) - (width / 2);
      const top = (window.screen.height / 2) - (height / 2);
      
      window.open(
        `oauth_mock.html?provider=${provider}`,
        'OAuth_Consent_Screen',
        `width=${width},height=${height},left=${left},top=${top},status=no,resizable=yes`
      );
    });
  });

  // Message receiver hook
  window.addEventListener('message', (event) => {
    if (event.data && event.data.status === 'SUCCESS') {
      const { provider, name, email } = event.data;
      
      const fullnameInput = document.getElementById('fullname');
      if (fullnameInput) {
        fullnameInput.value = name;
        if (regEmail) {
          regEmail.value = email;
          regEmail.dispatchEvent(new Event('input'));
        }
        alert(`Successfully imported registration profile from ${provider.toUpperCase()}.\nPlease fill in your mobile phone and password to complete registration.`);
        return;
      }

      const profileBadge = document.getElementById('social-profile-badge');
      if (profileBadge) {
        profileBadge.innerHTML = `
          <div class="profile-badge">
            <div class="profile-badge-avatar">${name.charAt(0)}</div>
            <div class="profile-badge-info">
              <h4>Connected via ${provider.toUpperCase()}</h4>
              <p>${name} (${email})</p>
            </div>
          </div>
        `;
        profileBadge.style.display = 'block';
      }
      
      if (identityInput) {
        identityInput.value = email;
        identityInput.dispatchEvent(new Event('input'));
      }
      if (passwordInput) {
        passwordInput.value = '••••••••••••••••';
      }
      
      socialSessionActive = true;
      alert(`Authenticated successfully via ${provider.toUpperCase()}! Logging you in...`);
      
      setTimeout(() => {
        if (loginForm) {
          loginForm.dispatchEvent(new Event('submit'));
        }
      }, 600);
    }
  });

  // Account Recovery Modal
  const recoveryTrigger = document.getElementById('btn-forgot-trigger');
  const recoveryModal = document.getElementById('recovery-modal');
  const recoveryClose = document.getElementById('recovery-modal-close');
  
  const tabEmail = document.getElementById('tab-btn-email');
  const tabSms = document.getElementById('tab-btn-sms');
  const panelEmail = document.getElementById('panel-email-recovery');
  const panelSms = document.getElementById('panel-sms-recovery');

  if (recoveryTrigger && recoveryModal) {
    recoveryTrigger.addEventListener('click', () => {
      recoveryModal.classList.add('active');
      resetRecoverySteps();
    });
  }

  if (recoveryClose) {
    recoveryClose.addEventListener('click', () => {
      recoveryModal.classList.remove('active');
    });
  }

  window.addEventListener('click', (e) => {
    if (e.target === recoveryModal) {
      recoveryModal.classList.remove('active');
    }
  });

  if (tabEmail && tabSms) {
    tabEmail.addEventListener('click', () => {
      tabEmail.classList.add('active');
      tabSms.classList.remove('active');
      panelEmail.classList.add('active');
      panelSms.classList.remove('active');
    });

    tabSms.addEventListener('click', () => {
      tabSms.classList.add('active');
      tabEmail.classList.remove('active');
      panelSms.classList.add('active');
      panelEmail.classList.remove('active');
    });
  }

  const emailRecoveryForm = document.getElementById('email-recovery-form');
  if (emailRecoveryForm) {
    emailRecoveryForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const recEmail = document.getElementById('recovery-email-input').value;
      alert(`Recovery link successfully compiled.\nDispatched to: ${recEmail}\nPlease check your inbox.`);
      recoveryModal.classList.remove('active');
    });
  }

  const smsReqForm = document.getElementById('sms-recovery-request-form');
  const smsStepRequest = document.getElementById('sms-step-request');
  const smsStepVerify = document.getElementById('sms-step-verify');
  const smsStepReset = document.getElementById('sms-step-reset');

  if (smsReqForm) {
    smsReqForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const phoneVal = document.getElementById('recovery-phone-input').value;
      
      const thPhoneRegex = /^0(6|8|9)\d{7,8}$/;
      if (!thPhoneRegex.test(phoneVal.trim())) {
        alert('Invalid mobile format. Please use a valid Thai number.');
        return;
      }

      alert(`SMS verification code dispatched.\nDestination: ${phoneVal}\n(Code: 4 4 0 1 9 2)`);
      smsStepRequest.style.display = 'none';
      smsStepVerify.style.display = 'block';
    });
  }

  const smsVerifyForm = document.getElementById('sms-recovery-verify-form');
  if (smsVerifyForm) {
    smsVerifyForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const codeVal = document.getElementById('recovery-otp-code').value;
      
      if (codeVal === '440192') {
        alert('Code confirmed successfully.');
        smsStepVerify.style.display = 'none';
        smsStepReset.style.display = 'block';
      } else {
        alert('Invalid recovery code. Please try again.');
      }
    });
  }

  const smsResetForm = document.getElementById('sms-recovery-reset-form');
  const recNewPassword = document.getElementById('recovery-new-password');
  
  if (recNewPassword) {
    recNewPassword.addEventListener('input', () => {
      const val = recNewPassword.value;
      const recStrength = document.getElementById('rec-pwd-strength-msg');
      const recLeak = document.getElementById('rec-pwd-leak-msg');
      
      if (!val) {
        recStrength.textContent = '';
        recLeak.textContent = '';
        return;
      }
      
      if (['password123', 'admin123', '12345678'].includes(val.toLowerCase())) {
        recLeak.textContent = '⚠ Warning: Leaked password flagged.';
        recLeak.className = 'feedback-msg warning';
      } else {
        recLeak.textContent = '✓ Secure password integrity';
        recLeak.className = 'feedback-msg success';
      }

      if (val.length < 8) {
        recStrength.textContent = '✗ Password must be at least 8 characters';
        recStrength.className = 'feedback-msg error';
      } else {
        recStrength.textContent = '✓ Secure strength';
        recStrength.className = 'feedback-msg success';
      }
    });
  }

  if (smsResetForm) {
    smsResetForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const leakMsg = document.getElementById('rec-pwd-leak-msg');
      const strengthMsg = document.getElementById('rec-pwd-strength-msg');
      
      if (leakMsg.classList.contains('warning') || strengthMsg.classList.contains('error')) {
        alert('Please supply a secure, non-breached password.');
        return;
      }
      
      alert('Password updated successfully. Please sign in with your new credentials.');
      recoveryModal.classList.remove('active');
    });
  }


  // ==========================================
  // SECTION 2: SaaS DASHBOARD INTERACTIONS
  // ==========================================

  // Sidebar Panel Toggles
  const sidebarItems = document.querySelectorAll('.sidebar-menu .menu-item');
  const panels = document.querySelectorAll('.dashboard-panel');
  const panelTitle = document.getElementById('active-panel-title');

  if (sidebarItems.length > 0) {
    sidebarItems.forEach(item => {
      item.addEventListener('click', () => {
        // Toggle active menu item
        sidebarItems.forEach(i => i.classList.remove('active'));
        item.classList.add('active');

        // Toggle active dashboard panel
        const targetId = item.getAttribute('data-target');
        panels.forEach(panel => {
          panel.classList.remove('active');
          if (panel.id === targetId) {
            panel.classList.add('active');
          }
        });

        // Update panel title header
        const btnText = item.querySelector('button').textContent;
        panelTitle.textContent = btnText.substring(2); // strip emoji
      });
    });
  }

  // Sidebar drag and drop reordering
  const sidebarMenu = document.querySelector('.sidebar-menu');
  if (sidebarMenu) {
    // Restore saved drag order
    const savedOrder = JSON.parse(localStorage.getItem('fincomm_sidebar_order'));
    if (savedOrder) {
      savedOrder.forEach(targetId => {
        const item = sidebarMenu.querySelector(`[data-target="${targetId}"]`);
        if (item) {
          sidebarMenu.appendChild(item);
        }
      });
    }

    const items = sidebarMenu.querySelectorAll('.menu-item');
    items.forEach(item => {
      item.addEventListener('dragstart', () => {
        item.classList.add('dragging');
      });

      item.addEventListener('dragend', () => {
        item.classList.remove('dragging');
        // Serialize and save drag order
        const order = [...sidebarMenu.querySelectorAll('.menu-item')].map(i => i.getAttribute('data-target'));
        localStorage.setItem('fincomm_sidebar_order', JSON.stringify(order));
      });
    });

    sidebarMenu.addEventListener('dragover', (e) => {
      e.preventDefault();
      const draggingElement = document.querySelector('.dragging');
      if (!draggingElement) return;

      const afterElement = getDragAfterElement(sidebarMenu, e.clientY);
      if (afterElement == null) {
        sidebarMenu.appendChild(draggingElement);
      } else {
        sidebarMenu.insertBefore(draggingElement, afterElement);
      }
    });

    function getDragAfterElement(container, y) {
      const draggableElements = [...container.querySelectorAll('.menu-item:not(.dragging)')];

      return draggableElements.reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;
        if (offset < 0 && offset > closest.offset) {
          return { offset: offset, element: child };
        } else {
          return closest;
        }
      }, { offset: Number.NEGATIVE_INFINITY }).element;
    }
  }

  // Shortcut navigation click handlers
  const shortcutButtons = document.querySelectorAll('[data-shortcut-target]');
  if (shortcutButtons.length > 0) {
    shortcutButtons.forEach(shortcut => {
      shortcut.addEventListener('click', (e) => {
        e.preventDefault();
        const target = shortcut.getAttribute('data-shortcut-target');
        const menuItem = Array.from(sidebarItems).find(i => i.getAttribute('data-target') === target);
        if (menuItem) {
          menuItem.click();
        }
      });
    });
  }

  // Dashboard Filters & Mock Data Simulation
  const filterShopee = document.getElementById('filter-shopee');
  const filterLazada = document.getElementById('filter-lazada');
  const filterTiktok = document.getElementById('filter-tiktok');
  const rangeButtons = document.querySelectorAll('.toggle-buttons .toggle-btn');
  
  const valGMV = document.getElementById('val-gmv');
  const valCommission = document.getElementById('val-commission');
  const valPayout = document.getElementById('val-payout');

  function updateDashboardMetricsSim() {
    if (!valGMV) return;

    let baseGMV = 245800.00;
    
    // Scale based on selected time range
    const activeRange = document.querySelector('.toggle-buttons .toggle-btn.active')?.getAttribute('data-time') || 'monthly';
    if (activeRange === 'daily') baseGMV /= 30.0;
    if (activeRange === 'weekly') baseGMV /= 4.0;
    if (activeRange === 'yearly') baseGMV *= 12.0;

    // Deduct/adjust based on platform exclusions
    let mult = 1.0;
    if (filterShopee && !filterShopee.checked) mult -= 0.35;
    if (filterLazada && !filterLazada.checked) mult -= 0.40;
    if (filterTiktok && !filterTiktok.checked) mult -= 0.25;

    const currentGMV = baseGMV * mult;
    const currentComm = currentGMV * 0.075; // average 7.5% platform commission
    const currentPayout = currentGMV - currentComm;

    valGMV.textContent = '฿' + currentGMV.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    valCommission.textContent = '฿' + currentComm.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    valPayout.textContent = '฿' + currentPayout.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  if (filterShopee) filterShopee.addEventListener('change', updateDashboardMetricsSim);
  if (filterLazada) filterLazada.addEventListener('change', updateDashboardMetricsSim);
  if (filterTiktok) filterTiktok.addEventListener('change', updateDashboardMetricsSim);

  if (rangeButtons.length > 0) {
    rangeButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        rangeButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        updateDashboardMetricsSim();
      });
    });
  }

  // Bulk print shortcut button redirects to Order Management Tab
  const btnBulkPrint = document.getElementById('btn-bulk-print');
  if (btnBulkPrint) {
    btnBulkPrint.addEventListener('click', () => {
      // Find and click the Order Management tab in the sidebar
      const orderMenuItem = Array.from(sidebarItems).find(i => i.getAttribute('data-target') === 'panel-orders');
      if (orderMenuItem) {
        orderMenuItem.click();
      }

      // Auto-select all new and ready orders
      ordersList.forEach(o => {
        if (o.status === 'New Order' || o.status === 'Ready to Ship') {
          o.selected = true;
        }
      });
      renderOrdersTable();

      // Trigger the AWB print log spooler
      setTimeout(() => {
        printDocuments('AWB');
      }, 300);
    });
  }

  // Low Inventory Configuration Alerts Modal
  const btnTriggerAlert = document.getElementById('btn-trigger-alert-modal');
  const alertModal = document.getElementById('alert-modal');
  const alertClose = document.getElementById('alert-modal-close');
  const alertForm = document.getElementById('alert-setup-form');

  if (btnTriggerAlert && alertModal) {
    btnTriggerAlert.addEventListener('click', () => {
      alertModal.classList.add('active');
    });
  }

  if (alertClose) {
    alertClose.addEventListener('click', () => {
      alertModal.classList.remove('active');
    });
  }

  if (alertForm) {
    alertForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const thresholdVal = document.getElementById('alert-threshold-input').value;
      alert(`Stock warnings activated! Alerts will trigger when any Master SKU dips below ${thresholdVal} items.`);
      alertModal.classList.remove('active');
    });
  }

  // ==========================================
  // SECTION 3: INVENTORY MOCK DATA & CRUD OPERATIONS
  // ==========================================
  
  let inventoryItems = [
    { sku: 'FIN-T-RED', name: 'Premium T-Shirt (Red)', stock: 142, cost: 150, price: 299, competitors: 14, shopee: true, lazada: true, tiktok: true },
    { sku: 'FIN-T-BLU', name: 'Premium T-Shirt (Blue)', stock: 85, cost: 150, price: 299, competitors: 9, shopee: true, lazada: true, tiktok: false },
    { sku: 'FIN-K-BLU', name: 'Stainless Tumbler (Blue)', stock: 12, cost: 250, price: 450, competitors: 22, shopee: false, lazada: true, tiktok: false }
  ];

  const tableBody = document.getElementById('inventory-table-body');
  const searchInput = document.getElementById('inventory-search');

  // Modals for CRUD
  const addModal = document.getElementById('add-product-modal');
  const editModal = document.getElementById('edit-product-modal');
  const deleteModal = document.getElementById('delete-product-modal');

  const btnAddProduct = document.getElementById('btn-add-product');

  // Close triggers
  document.getElementById('add-product-close')?.addEventListener('click', () => addModal.classList.remove('active'));
  document.getElementById('edit-product-close')?.addEventListener('click', () => editModal.classList.remove('active'));
  document.getElementById('delete-product-close')?.addEventListener('click', () => deleteModal.classList.remove('active'));

  // Open Add modal
  if (btnAddProduct) {
    btnAddProduct.addEventListener('click', () => {
      document.getElementById('add-product-form').reset();
      if (typeof updateAddProfitLabel === 'function') {
        updateAddProfitLabel();
      }
      addModal.classList.add('active');
    });
  }

  // Render Inventory Table
  function renderInventoryTable(itemsToRender = inventoryItems) {
    if (!tableBody) return;
    tableBody.innerHTML = '';

    if (itemsToRender.length === 0) {
      tableBody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding: 2rem; color: var(--color-text-muted);">No products found matching criteria.</td></tr>`;
      return;
    }

    itemsToRender.forEach(item => {
      const tr = document.createElement('tr');
      
      // Build Linked Channels Badges
      let badges = '';
      if (item.shopee) badges += `<span class="table-mapping-box">Shopee (${item.stock})</span>`;
      if (item.lazada) badges += `<span class="table-mapping-box">Lazada (${item.stock})</span>`;
      if (item.tiktok) badges += `<span class="table-mapping-box">TikTok (${item.stock})</span>`;
      if (!item.shopee && !item.lazada && !item.tiktok) {
        badges = `<span class="table-mapping-box" style="background: rgba(239, 68, 68, 0.1); color: var(--color-error); border-color: rgba(239,68,68,0.2);">Unmapped</span>`;
      }

      const planVal = document.getElementById('profile-plan-select')?.value || 'Free';
      const isTopTier = planVal === 'Advance' || planVal === 'Ultra';
      const competitorsHtml = isTopTier 
        ? `<span style="color: var(--color-secondary); font-weight: 500;">${item.competitors} Shops</span>`
        : `<span class="status-badge status-ultra" style="font-size: 0.65rem; background: rgba(99, 102, 241, 0.12); color: var(--color-primary); border-color: rgba(99,102,241,0.25); cursor: pointer; padding: 0.15rem 0.45rem; border-radius: 4px;" onclick="const el = document.querySelector('.sidebar-menu [data-target=\\'panel-profile\\']'); if(el) el.click(); const subTab = document.getElementById(\\'profile-subtab-plans\\'); if(subTab) subTab.click();">🔒 Upgrade</span>`;

      tr.innerHTML = `
        <td style="font-weight:600; color: var(--color-text-main);">${item.sku}</td>
        <td>${item.name}</td>
        <td>${item.stock} items</td>
        <td>${badges}</td>
        <td>฿${item.price.toFixed(2)} <span style="font-size: 0.7rem; color: var(--color-text-muted);">/ ฿${(item.cost || 0).toFixed(2)}</span></td>
        <td>${competitorsHtml}</td>
        <td style="text-align: center;">
          <button class="btn btn-secondary btn-edit-row" data-sku="${item.sku}" style="padding: 0.25rem 0.5rem; font-size: 0.75rem; width: auto; display: inline-block; margin-right: 0.25rem; margin-top:0;">✏️ Edit</button>
          <button class="btn btn-secondary btn-delete-row" data-sku="${item.sku}" style="padding: 0.25rem 0.5rem; font-size: 0.75rem; width: auto; display: inline-block; background: var(--color-error); color: #fff; border-color: var(--color-error); margin-top:0;">🗑️ Del</button>
        </td>
      `;

      tableBody.appendChild(tr);
    });

    // Attach Row CRUD Triggers
    document.querySelectorAll('.btn-edit-row').forEach(btn => {
      btn.addEventListener('click', () => {
        const sku = btn.getAttribute('data-sku');
        const item = inventoryItems.find(i => i.sku === sku);
        if (item) {
          document.getElementById('edit-sku').value = item.sku;
          document.getElementById('edit-name').value = item.name;
          document.getElementById('edit-stock').value = item.stock;
          document.getElementById('edit-cost-price').value = item.cost || 0;
          document.getElementById('edit-price').value = item.price;
          
          document.getElementById('edit-sync-shopee').checked = item.shopee;
          document.getElementById('edit-sync-lazada').checked = item.lazada;
          document.getElementById('edit-sync-tiktok').checked = item.tiktok;

          if (typeof updateEditProfitLabel === 'function') {
            updateEditProfitLabel();
          }

          editModal.classList.add('active');
        }
      });
    });

    document.querySelectorAll('.btn-delete-row').forEach(btn => {
      btn.addEventListener('click', () => {
        const sku = btn.getAttribute('data-sku');
        const item = inventoryItems.find(i => i.sku === sku);
        if (item) {
          document.getElementById('delete-sku').value = item.sku;
          document.getElementById('delete-warning-text').textContent = `Are you sure you want to delete the product "${item.name}" (SKU: ${item.sku})? This action will remove the record centrally.`;
          
          document.getElementById('delete-sync-shopee').checked = item.shopee;
          document.getElementById('delete-sync-lazada').checked = item.lazada;
          document.getElementById('delete-sync-tiktok').checked = item.tiktok;

          deleteModal.classList.add('active');
        }
      });
    });
  }

  // Initial table render
  renderInventoryTable();

  // Search & Platform Filter
  const platformFilter = document.getElementById('inventory-platform-filter');

  function applyInventoryFilters() {
    const q = searchInput ? searchInput.value.toLowerCase().trim() : '';
    const platform = platformFilter ? platformFilter.value : 'ALL';

    const filtered = inventoryItems.filter(item => {
      const matchesSearch = item.sku.toLowerCase().includes(q) || item.name.toLowerCase().includes(q);
      
      let matchesPlatform = true;
      if (platform === 'shopee') {
        matchesPlatform = item.shopee === true;
      } else if (platform === 'lazada') {
        matchesPlatform = item.lazada === true;
      } else if (platform === 'tiktok') {
        matchesPlatform = item.tiktok === true;
      } else if (platform === 'unmapped') {
        matchesPlatform = !item.shopee && !item.lazada && !item.tiktok;
      }

      return matchesSearch && matchesPlatform;
    });

    renderInventoryTable(filtered);
  }

  if (searchInput) {
    searchInput.addEventListener('input', applyInventoryFilters);
  }
  if (platformFilter) {
    platformFilter.addEventListener('change', applyInventoryFilters);
  }

  // Dynamic estimated profit calculation gating & rendering
  function calculateEstimatedProfit(priceInputId, costInputId, labelId) {
    const priceEl = document.getElementById(priceInputId);
    const costEl = document.getElementById(costInputId);
    const labelEl = document.getElementById(labelId);
    if (!priceEl || !costEl || !labelEl) return;

    const planVal = document.getElementById('profile-plan-select')?.value || 'Free';
    const isTopTier = planVal === 'Advance' || planVal === 'Ultra';

    if (!isTopTier) {
      labelEl.innerHTML = `<span class="status-badge status-ultra" style="font-size: 0.65rem; background: rgba(99, 102, 241, 0.12); color: var(--color-primary); border-color: rgba(99,102,241,0.25); cursor: pointer; padding: 0.15rem 0.45rem; border-radius: 4px;" onclick="const el = document.querySelector('.sidebar-menu [data-target=\\'panel-profile\\']'); if(el) el.click(); const subTab = document.getElementById(\\'profile-subtab-plans\\'); if(subTab) subTab.click();">🔒 Locked (Advance/Ultra required)</span>`;
      return;
    }

    const price = parseFloat(priceEl.value) || 0;
    const cost = parseFloat(costEl.value) || 0;
    const profit = price - cost;
    const margin = price > 0 ? (profit / price) * 100 : 0;

    labelEl.textContent = `Estimated Profit: ฿${profit.toFixed(2)} (${margin.toFixed(1)}%)`;
    if (profit >= 0) {
      labelEl.style.color = 'var(--color-success)';
    } else {
      labelEl.style.color = 'var(--color-error)';
    }
  }

  window.updateAddProfitLabel = function() {
    calculateEstimatedProfit('add-price', 'add-cost-price', 'add-estimated-profit-label');
  };

  window.updateEditProfitLabel = function() {
    calculateEstimatedProfit('edit-price', 'edit-cost-price', 'edit-estimated-profit-label');
  };

  document.getElementById('add-price')?.addEventListener('input', updateAddProfitLabel);
  document.getElementById('add-cost-price')?.addEventListener('input', updateAddProfitLabel);
  document.getElementById('edit-price')?.addEventListener('input', updateEditProfitLabel);
  document.getElementById('edit-cost-price')?.addEventListener('input', updateEditProfitLabel);

  // Create Product Form Submit
  const addForm = document.getElementById('add-product-form');
  if (addForm) {
    addForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const sku = document.getElementById('add-sku').value.trim().toUpperCase();
      const name = document.getElementById('add-name').value.trim();
      const stock = parseInt(document.getElementById('add-stock').value);
      const cost = parseFloat(document.getElementById('add-cost-price').value) || 0;
      const price = parseFloat(document.getElementById('add-price').value);

      const shopee = document.getElementById('add-sync-shopee').checked;
      const lazada = document.getElementById('add-sync-lazada').checked;
      const tiktok = document.getElementById('add-sync-tiktok').checked;

      // Duplicate Check
      if (inventoryItems.some(i => i.sku === sku)) {
        alert('Error: SKU already exists in inventory.');
        return;
      }

      const newItem = { sku, name, stock, cost, price, competitors: 0, shopee, lazada, tiktok };
      inventoryItems.unshift(newItem); // Add to beginning of catalog list
      applyInventoryFilters();

      let channels = [];
      if (shopee) channels.push("Shopee TH");
      if (lazada) channels.push("Lazada TH");
      if (tiktok) channels.push("TikTok TH");

      alert(`Success: Created Master SKU "${name}" [${sku}].\nSynchronized listing creation to: ${channels.join(', ') || 'No platforms (Saved Locally)'}`);
      addModal.classList.remove('active');
    });
  }

  // Edit Product Form Submit
  const editForm = document.getElementById('edit-product-form');
  if (editForm) {
    editForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const sku = document.getElementById('edit-sku').value;
      const name = document.getElementById('edit-name').value.trim();
      const stock = parseInt(document.getElementById('edit-stock').value);
      const cost = parseFloat(document.getElementById('edit-cost-price').value) || 0;
      const price = parseFloat(document.getElementById('edit-price').value);

      const shopee = document.getElementById('edit-sync-shopee').checked;
      const lazada = document.getElementById('edit-sync-lazada').checked;
      const tiktok = document.getElementById('edit-sync-tiktok').checked;

      const idx = inventoryItems.findIndex(i => i.sku === sku);
      if (idx !== -1) {
        inventoryItems[idx].name = name;
        inventoryItems[idx].stock = stock;
        inventoryItems[idx].cost = cost;
        inventoryItems[idx].price = price;
        inventoryItems[idx].shopee = shopee;
        inventoryItems[idx].lazada = lazada;
        inventoryItems[idx].tiktok = tiktok;
        
        applyInventoryFilters();

        let channels = [];
        if (shopee) channels.push("Shopee TH");
        if (lazada) channels.push("Lazada TH");
        if (tiktok) channels.push("TikTok TH");

        alert(`Success: Updated SKU ${sku}.\nSync requests dispatched to: ${channels.join(', ') || 'None'}`);
        editModal.classList.remove('active');
      }
    });
  }

  // Delete Product Form Submit
  const deleteForm = document.getElementById('delete-product-form');
  if (deleteForm) {
    deleteForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const sku = document.getElementById('delete-sku').value;

      const shopee = document.getElementById('delete-sync-shopee').checked;
      const lazada = document.getElementById('delete-sync-lazada').checked;
      const tiktok = document.getElementById('delete-sync-tiktok').checked;

      inventoryItems = inventoryItems.filter(i => i.sku !== sku);
      applyInventoryFilters();

      let channels = [];
      if (shopee) channels.push("Shopee TH");
      if (lazada) channels.push("Lazada TH");
      if (tiktok) channels.push("TikTok TH");

      alert(`Success: Removed central SKU ${sku}.\nListing deletion API calls executed on: ${channels.join(', ') || 'None'}`);
      deleteModal.classList.remove('active');
    });
  }

  // Single Listing Publisher Form Submit (Automatic redirect to Inventory screen)
  const batchUploadForm = document.getElementById('batch-upload-form');
  if (batchUploadForm) {
    batchUploadForm.addEventListener('submit', (e) => {
      e.preventDefault();
      
      const title = document.getElementById('single-pub-title').value.trim();
      const price = parseFloat(document.getElementById('single-pub-price').value);
      const stock = parseInt(document.getElementById('single-pub-stock').value);
      
      const shopee = document.getElementById('pub-shopee').checked;
      const lazada = document.getElementById('pub-lazada').checked;
      const tiktok = document.getElementById('pub-tiktok').checked;

      const mockSKU = `FIN-PUB-${Math.floor(100 + Math.random() * 900)}`;

      const newItem = { sku: mockSKU, name: title, stock, cost: Math.round(price * 0.5), price, competitors: 0, shopee, lazada, tiktok };
      inventoryItems.unshift(newItem);
      applyInventoryFilters();

      let platforms = [];
      if (shopee) platforms.push("Shopee TH");
      if (lazada) platforms.push("Lazada TH");
      if (tiktok) platforms.push("TikTok TH");

      alert(`Success: Single Listing published successfully!\nCreated SKU: ${mockSKU}.\nSynchronized live listings to: ${platforms.join(', ') || 'None'}.\nRedirecting you to the Inventory Catalog page.`);
      batchUploadForm.reset();

      // Auto-transition UI tab to Inventory Mapping panel
      const tabItem = document.querySelector('.sidebar-menu [data-target="panel-inventory"]');
      if (tabItem) {
        tabItem.click();
      }
    });
  }

  // Excel Template drag-drop upload simulator (Automatic redirect to Inventory screen)
  const excelFileInput = document.getElementById('excel-file-input');
  const excelDropZone = document.getElementById('excel-drop-zone');
  const excelDropText = document.getElementById('excel-drop-text');

  if (excelFileInput && excelDropZone) {
    excelFileInput.addEventListener('change', handleExcelUploadSimulation);
    
    excelDropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      excelDropZone.style.borderColor = 'var(--color-primary)';
      excelDropZone.style.background = 'rgba(79, 70, 229, 0.05)';
    });

    excelDropZone.addEventListener('dragleave', () => {
      excelDropZone.style.borderColor = 'var(--glass-border)';
      excelDropZone.style.background = 'rgba(255,255,255,0.01)';
    });

    excelDropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      excelDropZone.style.borderColor = 'var(--glass-border)';
      excelDropZone.style.background = 'rgba(255,255,255,0.01)';
      
      const files = e.dataTransfer.files;
      if (files.length > 0) {
        excelFileInput.files = files;
        handleExcelUploadSimulation();
      }
    });
  }

  function handleExcelUploadSimulation() {
    if (!excelDropText) return;
    
    const file = excelFileInput.files[0];
    if (!file) return;

    excelDropText.innerHTML = `<strong>Uploading:</strong> ${file.name}<br><span style="font-size:0.7rem; color:var(--color-primary);">Executing batch synchronization jobs...</span>`;

    setTimeout(() => {
      const shopee = document.getElementById('batch-shopee').checked;
      const lazada = document.getElementById('batch-lazada').checked;
      const tiktok = document.getElementById('batch-tiktok').checked;

      // Inject mock spreadsheet row parses
      const row1 = { sku: 'EXCEL-TSHIRT', name: 'Excel-Parsed Cotton T-Shirt', stock: 320, cost: 100, price: 180, competitors: 3, shopee, lazada, tiktok };
      const row2 = { sku: 'EXCEL-HOODIE', name: 'Excel-Parsed Cozy Hoodie', stock: 75, cost: 400, price: 690, competitors: 7, shopee, lazada, tiktok };

      inventoryItems.unshift(row1, row2);
      applyInventoryFilters();

      let platforms = [];
      if (shopee) platforms.push("Shopee TH");
      if (lazada) platforms.push("Lazada TH");
      if (tiktok) platforms.push("TikTok TH");

      alert(`Success: Parsed 2 inventory records from spreadsheet template!\nBatch jobs successfully registered on: ${platforms.join(', ') || 'No platforms (Saved Locally)'}.\nRedirecting you to the Inventory Catalog page.`);
      excelDropText.textContent = "Click to choose Excel spreadsheet";
      excelFileInput.value = '';

      // Auto-transition UI tab to Inventory Mapping panel
      const tabItem = document.querySelector('.sidebar-menu [data-target="panel-inventory"]');
      if (tabItem) {
        tabItem.click();
      }
    }, 1500);
  }

  // Strategic pricing calculator calculations
  const sliderCost = document.getElementById('slider-cost');
  const sliderComm = document.getElementById('slider-comm');
  const sliderShipping = document.getElementById('slider-shipping');
  
  const labelCost = document.getElementById('label-cost-val');
  const labelComm = document.getElementById('label-comm-val');
  const labelShipping = document.getElementById('label-shipping-val');
  
  const suggestPriceEl = document.getElementById('calc-suggested-price');
  const profitPctEl = document.getElementById('calc-profit-pct');

  function calculateTargetPricing() {
    if (!sliderCost) return;

    const baseCost = parseFloat(sliderCost.value);
    const commRate = parseFloat(sliderComm.value) / 100;
    const shippingCost = parseFloat(sliderShipping.value);

    // Update labels text
    labelCost.textContent = '฿' + baseCost.toFixed(2);
    labelComm.textContent = sliderComm.value + '%';
    labelShipping.textContent = '฿' + shippingCost.toFixed(2);

    // Calculation formula: Target Price = (Base Cost + Shipping) / (1 - Commission - Target Margin)
    // Assume a solid default target margin of 35%
    const targetMargin = 0.35;
    const suggestedPrice = (baseCost + shippingCost) / (1 - commRate - targetMargin);

    // Calculate margins percentage
    const profitAmount = suggestedPrice - baseCost - (suggestedPrice * commRate) - shippingCost;
    const profitPct = (profitAmount / suggestedPrice) * 100;

    suggestPriceEl.textContent = '฿' + Math.max(suggestedPrice, 0).toFixed(2);
    profitPctEl.textContent = Math.max(profitPct, 0).toFixed(1) + '%';
  }

  if (sliderCost) {
    sliderCost.addEventListener('input', calculateTargetPricing);
    sliderComm.addEventListener('input', calculateTargetPricing);
    sliderShipping.addEventListener('input', calculateTargetPricing);
    
    // Initial run
    calculateTargetPricing();
  }


  // --- Helper Functions ---

  function resetRecoverySteps() {
    if (smsStepRequest) smsStepRequest.style.display = 'block';
    if (smsStepVerify) smsStepVerify.style.display = 'none';
    if (smsStepReset) smsStepReset.style.display = 'none';
    
    const ef = document.getElementById('email-recovery-form');
    if (ef) ef.reset();
    const rf = document.getElementById('sms-recovery-request-form');
    if (rf) rf.reset();
    const vf = document.getElementById('sms-recovery-verify-form');
    if (vf) vf.reset();
    const sf = document.getElementById('sms-recovery-reset-form');
    if (sf) sf.reset();
  }

  function establishSuccessfulLogin(username, rememberMe) {
    if (rememberMe) {
      localStorage.setItem('fincomm_remembered_user', username);
      document.cookie = "fincomm_session=active_tenant_session; max-age=31536000; path=/";
    } else {
      localStorage.removeItem('fincomm_remembered_user');
      document.cookie = "fincomm_session=active_tenant_session; path=/";
    }
    triggerMFAChallenge();
  }

  function triggerMFAChallenge() {
    if (loginPanel && mfaPanel) {
      loginPanel.classList.remove('active');
      mfaPanel.classList.add('active');
      startOtpCooldownTimer(60);
      alert('Security Verification Challenge required. Enter 6-digit OTP code.');
    }
  }

  function verifyOTPCode() {
    const enteredCode = Array.from(otpInputs).map(inp => inp.value).join('');
    if (typeof Clerk !== 'undefined' && Clerk.user) {
      window.verifyClerkOTPCode(enteredCode);
      return;
    }
    if (enteredCode === '882049') {
      alert('2-Step Verification Completed Successfully!');
      window.location.href = 'dashboard.html';
    } else {
      alert('Invalid verification code. Please try again.');
      otpInputs.forEach(inp => inp.value = '');
      otpInputs[0].focus();
    }
  }

  function startOtpCooldownTimer(duration) {
    if (!mfaTimerText) return;
    let timer = duration;
    resendOtpBtn.disabled = true;
    
    const interval = setInterval(() => {
      mfaTimerText.textContent = `00:${timer < 10 ? '0' + timer : timer}`;
      timer--;

      if (timer < 0) {
        clearInterval(interval);
        mfaTimerText.textContent = '';
        resendOtpBtn.disabled = false;
      }
    }, 1000);
  }

  function checkRememberMe() {
    const savedUser = localStorage.getItem('fincomm_remembered_user');
    if (savedUser && identityInput) {
      identityInput.value = savedUser;
      const rememberCheckbox = document.getElementById('remember-me');
      if (rememberCheckbox) rememberCheckbox.checked = true;
      identityInput.dispatchEvent(new Event('input'));
    }
  }

  function renderDeviceConsole() {
    const listContainer = document.getElementById('active-device-list');
    const profileListContainer = document.getElementById('active-device-list-profile');
    
    // Render for login page
    if (listContainer) {
      listContainer.innerHTML = '';
      populateContainer(listContainer, 'login');
    }
    
    // Render for profile page
    if (profileListContainer) {
      profileListContainer.innerHTML = '';
      populateContainer(profileListContainer, 'profile');
    }

    function populateContainer(container, prefix) {
      activeSessions.forEach(session => {
        const item = document.createElement('div');
        item.className = 'device-item';
        item.id = `${prefix}-${session.id}`;

        const deviceLogo = session.name.toLowerCase().includes('iphone') || session.name.toLowerCase().includes('android') ? '📱' : '💻';

        item.innerHTML = `
          <div class="device-details">
            <div class="device-icon">${deviceLogo}</div>
            <div class="device-info">
              <h4>${session.name} ${session.current ? '<span class="status-badge current">Current Session</span>' : '<span class="status-badge remote">Active Session</span>'}</h4>
              <p>IP Address: ${session.ip} • Location: ${session.loc}</p>
            </div>
          </div>
          ${!session.current ? `<button class="revoke-btn" onclick="revokeSession('${session.id}')">Revoke Access</button>` : ''}
        `;

        container.appendChild(item);
      });
    }
  }

  // Trigger initial device render
  renderDeviceConsole();

  window.downloadSampleTemplate = function() {
    const headers = "master_sku,product_name,cost_price,selling_price,stock_level,shopee_sku,lazada_sku,tiktok_sku\n" +
                    "FIN-TSHIRT-RED,Premium Cotton Red T-Shirt,120.00,250.00,100,SH-RED-T,LZ-RED-T,TT-RED-T\n" +
                    "FIN-HOODIE-BLK,Classic Warm Black Hoodie,350.00,790.00,50,SH-BLK-H,LZ-BLK-H,TT-BLK-H";
    const blob = new Blob([headers], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.setAttribute('download', 'fincommerce_batch_template.csv');
    a.click();
  };

  window.revokeSession = function(sessionId) {
    const loginElement = document.getElementById(`login-${sessionId}`);
    const profileElement = document.getElementById(`profile-${sessionId}`);

    if (confirm('Are you sure you want to terminate this session? The device will be signed out immediately.')) {
      if (loginElement) {
        loginElement.style.opacity = '0';
        loginElement.style.transform = 'translateX(50px)';
      }
      if (profileElement) {
        profileElement.style.opacity = '0';
        profileElement.style.transform = 'translateX(50px)';
      }
      
      setTimeout(() => {
        activeSessions = activeSessions.filter(s => s.id !== sessionId);
        renderDeviceConsole();
        alert('Session terminated. WebSocket signal triggered.');
      }, 300);
    }
  };


  // ==========================================
  // SECTION 4: BILLING & CHECKOUT SIMULATOR
  // ==========================================

  const checkoutModal = document.getElementById('checkout-modal');
  const btnCloseCheckout = document.getElementById('checkout-modal-close');

  // Image Viewer Modal Setup
  const imageViewerModal = document.getElementById('image-viewer-modal');
  const imageViewerClose = document.getElementById('image-viewer-close');
  const imageViewerImg = document.getElementById('image-viewer-img');
  const imageViewerTitle = document.getElementById('image-viewer-title');

  window.openImageModal = function(imgSrc, title) {
    if (imageViewerModal && imageViewerImg) {
      imageViewerImg.src = imgSrc;
      if (imageViewerTitle) imageViewerTitle.textContent = `Attachment: ${title}`;
      imageViewerModal.classList.add('active');
    }
  };

  if (imageViewerClose) {
    imageViewerClose.addEventListener('click', () => {
      if (imageViewerModal) imageViewerModal.classList.remove('active');
    });
  }

  // Click outside to close image modal
  window.addEventListener('click', (e) => {
    if (e.target === imageViewerModal) {
      imageViewerModal.classList.remove('active');
    }
  });
  
  const btnUpgradeBasic = document.getElementById('billing-upgrade-basic');
  const btnUpgradeAdvance = document.getElementById('billing-upgrade-advance');
  const btnUpgradeUltra = document.getElementById('billing-upgrade-ultra');

  const checkoutTitle = document.getElementById('checkout-title');
  const checkoutSubtitle = document.getElementById('checkout-subtitle');

  let selectedCheckoutPlan = '';
  let selectedCheckoutPrice = 0;
  let promptPayTimerInterval = null;

  if (btnUpgradeBasic) {
    btnUpgradeBasic.addEventListener('click', () => openCheckout('Basic', 599));
  }
  if (btnUpgradeAdvance) {
    btnUpgradeAdvance.addEventListener('click', () => openCheckout('Advance', 1299));
  }
  if (btnUpgradeUltra) {
    btnUpgradeUltra.addEventListener('click', () => openCheckout('Ultra', 2990));
  }
  if (btnCloseCheckout) {
    btnCloseCheckout.addEventListener('click', closeCheckout);
  }

  // PromptPay CRC-16 CCITT calculations
  function crc16(data) {
    let crc = 0xFFFF;
    for (let c = 0; c < data.length; c++) {
      let charCode = data.charCodeAt(c);
      let x = ((crc >> 8) ^ charCode) & 0xFF;
      x ^= x >> 4;
      crc = ((crc << 8) ^ (x << 12) ^ (x << 5) ^ (x << 1)) & 0xFFFF;
    }
    return crc;
  }

  function generatePromptPayPayload(targetNumber, amount) {
    let target = targetNumber.replace(/[^0-9]/g, '');
    if (target.length === 10 && target.startsWith('0')) {
      target = '66' + target.substring(1);
    }
    const isPhone = target.length < 13;
    const targetFormatted = isPhone ? ("00" + target) : target;
    let payload = "000201010212";
    let merchantInfo = "0010A000000677010111";
    if (isPhone) {
      merchantInfo += "0113" + targetFormatted;
    } else {
      merchantInfo += "0213" + targetFormatted;
    }
    payload += "29" + ("00" + merchantInfo.length).slice(-2) + merchantInfo;
    payload += "5303764";
    let amountStr = amount.toFixed(2);
    payload += "54" + ("00" + amountStr.length).slice(-2) + amountStr;
    payload += "5802TH6304";
    let crc = crc16(payload);
    payload += ("0000" + crc.toString(16).toUpperCase()).slice(-4);
    return payload;
  }

  let promptPayPollInterval = null;

  async function initializePromptPayQR() {
    const qrImg = document.getElementById('qr-code-img');
    const timerLabel = document.getElementById('qr-timer-label');
    const statusLabel = document.getElementById('qr-status-label');
    if (!qrImg || !timerLabel || !statusLabel) return;

    if (promptPayTimerInterval) clearInterval(promptPayTimerInterval);
    if (promptPayPollInterval) clearInterval(promptPayPollInterval);

    statusLabel.textContent = '⏳ Fetching secure PromptPay QR from Stripe...';
    timerLabel.textContent = '';

    try {
      const email = Clerk?.user?.primaryEmailAddress?.emailAddress || 'somchai@gmail.com';
      const res = await fetch(getApiUrl('/api/v1/stripe/create-payment-intent'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan_name: selectedCheckoutPlan,
          email: email
        })
      });

      if (!res.ok) throw new Error('Backend failed to create Stripe payment intent.');
      const data = await res.json();

      if (data.isMock) {
        runMockPromptPayFlow();
      } else {
        if (typeof Stripe === 'undefined') throw new Error('Stripe JS SDK not loaded.');
        const publishableKey = data.publishableKey || 'pk_test_mock_stripe_publishable_key';
        const tempStripe = Stripe(publishableKey);

        const result = await tempStripe.confirmPromptPayPayment(data.clientSecret, {
          payment_method: {
            billing_details: {
              name: Clerk?.user?.fullName || 'Somchai Prasert',
              email: email
            }
          }
        });

        if (result.error) {
          throw new Error(result.error.message);
        }

        const nextAction = result.paymentIntent.next_action;
        if (nextAction && nextAction.promptpay_display_qr_code) {
          const qrImageUrl = nextAction.promptpay_display_qr_code.image_url_png;
          qrImg.src = qrImageUrl;

          let countdown = 120;
          timerLabel.textContent = `Code expires in: ${countdown}s`;
          statusLabel.textContent = `⏳ Stripe QR code ready. Scan to complete transaction.`;

          promptPayTimerInterval = setInterval(() => {
            countdown--;
            timerLabel.textContent = `Code expires in: ${countdown}s`;
            if (countdown <= 0) {
              clearInterval(promptPayTimerInterval);
              clearInterval(promptPayPollInterval);
              timerLabel.textContent = 'Code expired';
              statusLabel.textContent = '❌ Transaction timed out. Please close and try again.';
            }
          }, 1000);

          promptPayPollInterval = setInterval(async () => {
            const pollRes = await tempStripe.retrievePaymentIntent(data.clientSecret);
            if (pollRes.paymentIntent && pollRes.paymentIntent.status === 'succeeded') {
              clearInterval(promptPayTimerInterval);
              clearInterval(promptPayPollInterval);
              statusLabel.textContent = '✅ Payment verified via Stripe callback!';
              setTimeout(() => {
                executePlanUpgrade(selectedCheckoutPlan);
              }, 1200);
            }
          }, 3000);
        } else {
          throw new Error('No PromptPay QR configuration returned by Stripe.');
        }
      }
    } catch (err) {
      console.warn("Stripe PromptPay QR generation failed, falling back to simulator:", err);
      runMockPromptPayFlow();
    }
  }

  function runMockPromptPayFlow() {
    const qrImg = document.getElementById('qr-code-img');
    const timerLabel = document.getElementById('qr-timer-label');
    const statusLabel = document.getElementById('qr-status-label');

    const qrPayload = generatePromptPayPayload("0812345678", selectedCheckoutPrice);
    if (qrImg) {
      qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(qrPayload)}`;
    }

    let countdown = 60;
    timerLabel.textContent = `Code expires in: ${countdown}s`;
    statusLabel.textContent = `⏳ Listening for transaction notification webhook...`;

    promptPayTimerInterval = setInterval(() => {
      countdown--;
      timerLabel.textContent = `Code expires in: ${countdown}s`;

      if (countdown === 55) {
        clearInterval(promptPayTimerInterval);
        statusLabel.textContent = `✅ Payment verified via bank API callback!`;
        setTimeout(() => {
          executePlanUpgrade(selectedCheckoutPlan);
        }, 1200);
      }

      if (countdown <= 0) {
        clearInterval(promptPayTimerInterval);
        timerLabel.textContent = `Code expired`;
        statusLabel.textContent = `❌ Transaction timed out. Please try again.`;
      }
    }, 1000);
  }

  function openCheckout(planName, price) {
    selectedCheckoutPlan = planName;
    selectedCheckoutPrice = price;

    if (checkoutTitle && checkoutSubtitle) {
      checkoutTitle.textContent = `Upgrade to ${planName} Plan`;
      checkoutSubtitle.textContent = `Total Due: ฿${price.toFixed(2)} / month`;
    }

    // Default to the QR tab when opening checkout
    const qrTab = document.getElementById('pay-tab-qr');
    const qrPanel = document.getElementById('pay-panel-qr');
    
    // Remove active state from all tabs
    Object.keys(payTabs).forEach(k => {
      payTabs[k].tab?.classList.remove('active');
      payTabs[k].panel?.classList.remove('active');
    });
    
    if (qrTab && qrPanel) {
      qrTab.classList.add('active');
      qrPanel.classList.add('active');
    }

    checkoutModal.classList.add('active');
    initializePromptPayQR();
  }

  function closeCheckout() {
    checkoutModal.classList.remove('active');
    if (promptPayTimerInterval) {
      clearInterval(promptPayTimerInterval);
    }
    if (promptPayPollInterval) {
      clearInterval(promptPayPollInterval);
    }
    // Clean up Stripe card instance
    if (cardElement) {
      cardElement.destroy();
      cardElement = null;
    }
    stripeInitialized = false;
  }

  // Payment method tab switching
  const payTabs = {
    qr: { tab: document.getElementById('pay-tab-qr'), panel: document.getElementById('pay-panel-qr') },
    card: { tab: document.getElementById('pay-tab-card'), panel: document.getElementById('pay-panel-card') },
    bank: { tab: document.getElementById('pay-tab-bank'), panel: document.getElementById('pay-panel-bank') },
    wallet: { tab: document.getElementById('pay-tab-wallet'), panel: document.getElementById('pay-panel-wallet') }
  };

  let stripe = null;
  let elements = null;
  let cardElement = null;
  let stripeInitialized = false;

  async function initializeStripe() {
    if (stripeInitialized) return;
    
    const cardElementContainer = document.getElementById('stripe-card-element');
    if (!cardElementContainer) return;

    try {
      const errorDisplay = document.getElementById('stripe-card-errors');
      if (errorDisplay) {
        errorDisplay.textContent = 'Initializing Stripe Elements...';
        errorDisplay.style.color = 'var(--color-text-muted)';
      }

      // Fetch checkout intent data (mostly to get the active test/live publishable key)
      const email = Clerk?.user?.primaryEmailAddress?.emailAddress || 'somchai@gmail.com';
      const res = await fetch(getApiUrl('/api/v1/stripe/create-payment-intent'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan_name: selectedCheckoutPlan || 'Basic',
          email: email
        })
      });

      if (!res.ok) {
        throw new Error('Failed to resolve payment intent configurations.');
      }

      const data = await res.json();
      const publishableKey = data.publishableKey || 'pk_test_mock_stripe_publishable_key';
      
      if (typeof Stripe !== 'undefined') {
        stripe = Stripe(publishableKey);
        elements = stripe.elements();
        
        const style = {
          base: {
            color: '#1e293b',
            fontFamily: '"Outfit", "Inter", sans-serif',
            fontSmoothing: 'antialiased',
            fontSize: '14px',
            '::placeholder': {
              color: '#94a3b8'
            }
          },
          invalid: {
            color: '#ef4444',
            iconColor: '#ef4444'
          }
        };

        cardElement = elements.create('card', { style: style, hidePostalCode: true });
        cardElement.mount('#stripe-card-element');

        cardElement.on('change', (event) => {
          if (errorDisplay) {
            errorDisplay.textContent = event.error ? event.error.message : '';
            errorDisplay.style.color = 'var(--color-error)';
          }
        });

        stripeInitialized = true;
        if (errorDisplay) errorDisplay.textContent = '';
      } else {
        throw new Error('Stripe JS SDK not loaded on client.');
      }
    } catch (err) {
      console.warn("Stripe Elements initialization failed, falling back to mock mode:", err);
      const errorDisplay = document.getElementById('stripe-card-errors');
      if (errorDisplay) {
        errorDisplay.textContent = 'Stripe Mock Mode Active. Fill Cardholder Name & Submit to proceed.';
        errorDisplay.style.color = 'var(--color-primary)';
      }
    }
  }

  Object.keys(payTabs).forEach(key => {
    const current = payTabs[key];
    if (current.tab) {
      current.tab.addEventListener('click', () => {
        // Remove active state
        Object.keys(payTabs).forEach(k => {
          payTabs[k].tab?.classList.remove('active');
          payTabs[k].panel?.classList.remove('active');
        });
        // Set current active
        current.tab.classList.add('active');
        current.panel.classList.add('active');

        // Dynamically initialize Stripe Card Elements if Credit Card tab is selected
        if (key === 'card') {
          initializeStripe();
        } else if (key === 'qr') {
          initializePromptPayQR();
        }
      });
    }
  });

  async function executePlanUpgrade(planName) {
    // 1. Fetch active payment details
    const activeTabId = document.querySelector('#checkout-modal .tab-btn.active')?.id;
    let paymentMethod = 'Credit Card';
    if (activeTabId === 'pay-tab-qr') paymentMethod = 'PromptPay';
    else if (activeTabId === 'pay-tab-wallet') paymentMethod = 'TrueMoney';
    else if (activeTabId === 'pay-tab-bank') paymentMethod = 'Mobile Banking';

    // 2. Persist to Clerk unsafeMetadata if logged in
    if (Clerk && Clerk.user) {
      try {
        const currentMetadata = Clerk.user.unsafeMetadata || {};
        await Clerk.user.update({
          unsafeMetadata: {
            ...currentMetadata,
            plan: planName,
            paymentMethod: paymentMethod
          }
        });
        console.log("Clerk metadata successfully upgraded to:", planName);
      } catch (err) {
        console.error("Failed to update Clerk user metadata:", err);
      }
    }

    // 3. Persist to local JSON DB and memory in FastAPI backend
    const email = Clerk?.user?.primaryEmailAddress?.emailAddress || 'somchai@gmail.com';
    try {
      await fetch(getApiUrl('/api/v1/stripe/upgrade-subscription'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email,
          plan_name: planName,
          payment_method: paymentMethod
        })
      });
    } catch (err) {
      console.error("Failed to sync backend subscription upgrade:", err);
    }

    alert(`Success: Payment Confirmed!\nYour account workspace has been upgraded to the ${planName} Plan.`);
    
    // Update Top Navigation account tier badge
    const badge = document.querySelector('.user-profile-badge');
    if (badge) {
      badge.textContent = `${planName} Tier`;
    }

    // Update Profile Plan details selectors
    const planSelect = document.getElementById('profile-plan-select');
    const paymentSelect = document.getElementById('profile-payment-select');
    if (planSelect) {
      planSelect.value = planName;
      planSelect.dispatchEvent(new Event('change'));
    }
    if (paymentSelect) {
      paymentSelect.value = paymentMethod === 'Credit Card' ? 'Credit Card' : 
                          (paymentMethod === 'PromptPay' ? 'PromptPay' : 
                          (paymentMethod === 'TrueMoney' ? 'TrueMoney' : 'Bank Transfer'));
      paymentSelect.dispatchEvent(new Event('change'));
    }

    // Disable upgrade buttons that were purchased
    const freeBtn = document.getElementById('billing-free-btn');
    const basicBtn = document.getElementById('billing-upgrade-basic');
    const advBtn = document.getElementById('billing-upgrade-advance');
    const ultraBtn = document.getElementById('billing-upgrade-ultra');

    if (planName === 'Basic') {
      if (basicBtn) {
        basicBtn.disabled = true;
        basicBtn.textContent = 'Current Plan';
      }
      if (advBtn) {
        advBtn.disabled = false;
        advBtn.textContent = 'Upgrade to Advance';
      }
      if (ultraBtn) {
        ultraBtn.disabled = false;
        ultraBtn.textContent = 'Upgrade to Ultra';
      }
    } else if (planName === 'Advance') {
      if (basicBtn) {
        basicBtn.disabled = true;
        basicBtn.textContent = 'Basic Tier Active';
      }
      if (advBtn) {
        advBtn.disabled = true;
        advBtn.textContent = 'Current Plan';
      }
      if (ultraBtn) {
        ultraBtn.disabled = false;
        ultraBtn.textContent = 'Upgrade to Ultra';
      }
    } else if (planName === 'Ultra') {
      if (basicBtn) {
        basicBtn.disabled = true;
        basicBtn.textContent = 'Basic Tier Active';
      }
      if (advBtn) {
        advBtn.disabled = true;
        advBtn.textContent = 'Advance Tier Active';
      }
      if (ultraBtn) {
        ultraBtn.disabled = true;
        ultraBtn.textContent = 'Current Plan';
      }
    }

    closeCheckout();
  }

  // Credit Card Form Submit Stripe Integration
  const cardForm = document.getElementById('card-payment-form');
  if (cardForm) {
    cardForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const submitBtn = document.getElementById('stripe-submit-btn');
      const cardholderInput = document.getElementById('stripe-cardholder-name');
      const errorDisplay = document.getElementById('stripe-card-errors');

      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Processing Payment Securely...';
      }
      if (errorDisplay) {
        errorDisplay.textContent = '';
      }

      try {
        const email = Clerk?.user?.primaryEmailAddress?.emailAddress || 'somchai@gmail.com';

        // 1. Create PaymentIntent on the backend
        const res = await fetch(getApiUrl('/api/v1/stripe/create-payment-intent'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            plan_name: selectedCheckoutPlan,
            email: email
          })
        });

        if (!res.ok) {
          throw new Error('Failed to communicate with local Stripe checkout service.');
        }

        const data = await res.json();

        // 2. Resolve Mock Mode vs. Real Elements Confirmation
        if (data.isMock || !stripeInitialized) {
          if (errorDisplay) {
            errorDisplay.textContent = '🔒 Authorizing mock Stripe checkout token...';
            errorDisplay.style.color = 'var(--color-success)';
          }
          setTimeout(async () => {
            await executePlanUpgrade(selectedCheckoutPlan);
            if (submitBtn) {
              submitBtn.disabled = false;
              submitBtn.textContent = 'Pay Securely via Stripe';
            }
          }, 1500);
        } else {
          // Confirm Real Card Payment via Stripe SDK
          const clientSecret = data.clientSecret;
          const cardholderName = cardholderInput ? cardholderInput.value.trim() : 'Somchai Prasert';

          const result = await stripe.confirmCardPayment(clientSecret, {
            payment_method: {
              card: cardElement,
              billing_details: {
                name: cardholderName,
                email: email
              }
            }
          });

          if (result.error) {
            throw new Error(result.error.message);
          } else if (result.paymentIntent && result.paymentIntent.status === 'succeeded') {
            if (errorDisplay) {
              errorDisplay.textContent = '✅ Payment Succeeded!';
              errorDisplay.style.color = 'var(--color-success)';
            }
            setTimeout(async () => {
              await executePlanUpgrade(selectedCheckoutPlan);
              if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Pay Securely via Stripe';
              }
            }, 1000);
          }
        }
      } catch (err) {
        console.error("Stripe payment error:", err);
        if (errorDisplay) {
          errorDisplay.textContent = `❌ checkout error: ${err.message}`;
          errorDisplay.style.color = 'var(--color-error)';
        }
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Pay Securely via Stripe';
        }
      }
    });
  }

  // Mobile Banking Redirect Simulator
  window.processMockBankRedirect = function(bankName) {
    alert(`Redirection Hook Dispatched: Opening mobile banking interface for ${bankName}...`);
    setTimeout(() => {
      executePlanUpgrade(selectedCheckoutPlan);
    }, 1500);
  };

  // E-Wallet Submit Simulation
  const walletForm = document.getElementById('wallet-payment-form');
  if (walletForm) {
    walletForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const provider = document.getElementById('wallet-provider-select').value;
      alert(`OTP Push Challenge sent to wallet app (${provider}). Approve the payment prompt on your phone.`);
      setTimeout(() => {
        executePlanUpgrade(selectedCheckoutPlan);
      }, 1500);
    });
  }


  // ==========================================
  // SECTION 5: PROFILE & SECURITY CONTROLLER
  // ==========================================

  const profileInfoForm = document.getElementById('profile-info-form');
  if (profileInfoForm) {
    profileInfoForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const fullName = document.getElementById('profile-full-name').value.trim();
      const email = document.getElementById('profile-email').value.trim();
      const phone = document.getElementById('profile-phone').value.trim();
      const company = document.getElementById('profile-company').value.trim();
      const taxId = document.getElementById('profile-tax-id').value.trim();
      const bankName = document.getElementById('profile-bank-name').value;
      const bankAcc = document.getElementById('profile-bank-acc').value.trim();

      alert(`Success: Saved Profile Info!\nName: ${fullName}\nEmail: ${email}\nPhone: ${phone}\nCompany: ${company}\nTax ID: ${taxId}\nSettlement Bank: ${bankName} (Acc: ${bankAcc})`);
    });
  }

  const fallbackBtnSaveTheme = document.getElementById('btn-save-theme');
  if (fallbackBtnSaveTheme) {
    fallbackBtnSaveTheme.addEventListener('click', (e) => {
      e.preventDefault();
      const selectedRadio = document.querySelector('input[name="bg-theme"]:checked');
      const themeValue = selectedRadio ? selectedRadio.value : 'white';
      
      localStorage.setItem('fincomm_theme', themeValue);
      applyTheme(themeValue);
      alert(`✓ Applied ${themeValue} theme locally.`);
    });
  }

  // Dynamic Subscription Plans Grid Renderer
  function renderDashboardSubscriptionPlans() {
    const plansGrid = document.getElementById('dashboard-plans-grid');
    if (!plansGrid) return;

    // Load custom configuration catalog or fallback
    const pricingCatalog = JSON.parse(localStorage.getItem('fincomm_pricing_catalog')) || {
      Free: { name: 'Free Tier', rate: 0, desc: 'Trial - Super Limited Usage', features: ['Up to 1 linked shop', 'Max 50 central SKUs', 'Max 10 daily synced orders', 'Manual stock synchronization'] },
      Basic: { name: 'Basic Tier', rate: 599, desc: 'Limited operations for starters', features: ['Up to 2 linked shops', 'Max 500 central SKUs', 'Max 150 daily orders', 'Standard Analytics reports'] },
      Advance: { name: 'Advance Tier', rate: 1299, desc: 'Excludes Strategic Calc & Accounting', features: ['Unlimited linked shops', 'Unlimited central SKUs', 'Real-time automated sync', 'Bulk publishers & logs', 'Email priority support'] },
      Ultra: { name: 'Ultra Tier', rate: 2990, desc: 'All features + Calculator + Accounting', features: ['Everything in Advance', 'Strategic Pricing Simulator', 'Accounting Ledger (Upcoming)', '24/7 VIP Dedicated Support SLA'] }
    };

    plansGrid.innerHTML = '';

    // Render 4 Plan Cards
    Object.keys(pricingCatalog).forEach(key => {
      const plan = pricingCatalog[key];
      const card = document.createElement('div');
      card.className = 'metric-card';
      
      // Styling styles based on package tier key
      let borderStyle = 'border: 1.5px solid var(--glass-border);';
      let shadowStyle = '';
      let headerColor = 'color: var(--color-text-muted);';
      let buttonHtml = '';
      let badgeHtml = '';

      if (key === 'Free') {
        buttonHtml = `<button class="btn btn-secondary" style="margin: 0; width: 100%;" disabled id="billing-free-btn">Current Active Plan</button>`;
      } else if (key === 'Basic') {
        borderStyle = 'border: 1.5px solid var(--color-secondary);';
        shadowStyle = 'box-shadow: 0 4px 10px rgba(0,0,0,0.02);';
        headerColor = 'color: var(--color-secondary);';
        buttonHtml = `<button class="btn btn-primary" style="margin: 0; width: 100%; background: var(--color-secondary); border-color: var(--color-secondary);" id="billing-upgrade-basic" onclick="openCheckout('Basic', ${plan.rate})">Upgrade to Basic</button>`;
      } else if (key === 'Advance') {
        borderStyle = 'border: 1.5px solid var(--color-primary);';
        shadowStyle = 'box-shadow: 0 4px 12px rgba(79, 70, 229, 0.08);';
        headerColor = 'color: var(--color-primary);';
        buttonHtml = `<button class="btn btn-primary" style="margin: 0; width: 100%;" id="billing-upgrade-advance" onclick="openCheckout('Advance', ${plan.rate})">Upgrade to Advance</button>`;
      } else if (key === 'Ultra') {
        borderStyle = 'border: 1.5px solid #10b981;';
        shadowStyle = 'box-shadow: 0 4px 14px rgba(16, 185, 129, 0.12); position: relative;';
        headerColor = 'color: #10b981;';
        badgeHtml = `<div style="position: absolute; top: -10px; right: 20px; background: #10b981; color: #fff; font-size: 0.65rem; padding: 0.2rem 0.5rem; border-radius: 8px; font-weight: 600;">BEST VALUE</div>`;
        buttonHtml = `<button class="btn btn-primary" style="margin: 0; width: 100%; background: #10b981; border-color: #10b981;" id="billing-upgrade-ultra" onclick="openCheckout('Ultra', ${plan.rate})">Upgrade to Ultra</button>`;
      }

      card.setAttribute('style', `display: flex; flex-direction: column; justify-content: space-between; border-radius: 16px; padding: 1.5rem; text-align: center; background: #ffffff; ${borderStyle} ${shadowStyle}`);

      card.innerHTML = `
        ${badgeHtml}
        <div>
          <h3 style="font-size: 1.1rem; ${headerColor} font-weight: 600; margin-bottom: 0.25rem;">${plan.name}</h3>
          <div style="font-size: 1.8rem; font-weight: 700; color: var(--color-text-main); margin-bottom: 1rem;">฿${plan.rate.toLocaleString()} <span style="font-size: 0.8rem; color: var(--color-text-muted); font-weight: 400;">/ mo</span></div>
          <p style="font-size: 0.75rem; color: var(--color-text-muted); margin-bottom: 1rem;">${plan.desc}</p>
          <ul style="text-align: left; font-size: 0.8rem; line-height: 1.6; margin-bottom: 1.5rem; color: var(--color-text-muted); padding-left: 1.2rem;">
            ${plan.features.map(f => `<li>${f}</li>`).join('')}
          </ul>
        </div>
        ${buttonHtml}
      `;
      plansGrid.appendChild(card);
    });

    // Refresh active plan state visual buttons
    updateActivePlanButtons();
  }

  function updateActivePlanButtons() {
    const planVal = document.getElementById('profile-plan-select')?.value || 'Free';
    
    const freeBtn = document.getElementById('billing-free-btn');
    const basicBtn = document.getElementById('billing-upgrade-basic');
    const advanceBtn = document.getElementById('billing-upgrade-advance');
    const ultraBtn = document.getElementById('billing-upgrade-ultra');

    if (freeBtn) {
      if (planVal === 'Free') {
        freeBtn.disabled = true;
        freeBtn.textContent = 'Current Active Plan';
        freeBtn.className = 'btn btn-secondary';
      } else {
        freeBtn.disabled = false;
        freeBtn.textContent = 'Downgrade to Free';
        freeBtn.className = 'btn btn-primary';
        freeBtn.onclick = () => executePlanUpgrade('Free');
      }
    }

    if (basicBtn) {
      if (planVal === 'Basic') {
        basicBtn.disabled = true;
        basicBtn.textContent = 'Current Active Plan';
        basicBtn.className = 'btn btn-secondary';
      } else {
        basicBtn.disabled = false;
        basicBtn.textContent = planVal === 'Free' ? 'Upgrade to Basic' : 'Change to Basic';
        basicBtn.className = 'btn btn-primary';
      }
    }

    if (advanceBtn) {
      if (planVal === 'Advance') {
        advanceBtn.disabled = true;
        advanceBtn.textContent = 'Current Active Plan';
        advanceBtn.className = 'btn btn-secondary';
      } else {
        advanceBtn.disabled = false;
        advanceBtn.textContent = (planVal === 'Free' || planVal === 'Basic') ? 'Upgrade to Advance' : 'Change to Advance';
        advanceBtn.className = 'btn btn-primary';
      }
    }

    if (ultraBtn) {
      if (planVal === 'Ultra') {
        ultraBtn.disabled = true;
        ultraBtn.textContent = 'Current Active Plan';
        ultraBtn.className = 'btn btn-secondary';
      } else {
        ultraBtn.disabled = false;
        ultraBtn.textContent = (planVal === 'Free' || planVal === 'Basic' || planVal === 'Advance') ? 'Upgrade to Ultra' : 'Change to Ultra';
        ultraBtn.className = 'btn btn-primary';
      }
    }
  }

  // Sync and display subscription status overlay card inside profile tab
  function updateSubscriptionStatusDisplay() {
    const planSelect = document.getElementById('profile-plan-select');
    const paymentSelect = document.getElementById('profile-payment-select');
    if (!planSelect || !paymentSelect) return;

    const planVal = planSelect.value;
    const paymentVal = paymentSelect.value;

    const statusTier = document.getElementById('profile-status-tier');
    const statusPrice = document.getElementById('profile-status-price');
    const statusMethod = document.getElementById('profile-status-method');

    if (statusTier) statusTier.textContent = `${planVal} Tier`;
    if (statusPrice) {
      // Find rate from custom catalog if available
      const pricingCatalog = JSON.parse(localStorage.getItem('fincomm_pricing_catalog')) || {};
      const planRate = pricingCatalog[planVal] ? pricingCatalog[planVal].rate : null;

      if (planRate !== null) {
        statusPrice.textContent = `฿${planRate.toLocaleString()} / mo`;
      } else {
        if (planVal === 'Free') statusPrice.textContent = '฿0.00 / mo';
        else if (planVal === 'Basic') statusPrice.textContent = '฿599.00 / mo';
        else if (planVal === 'Advance') statusPrice.textContent = '฿1,299.00 / mo';
        else if (planVal === 'Ultra') statusPrice.textContent = '฿2,990.00 / mo';
      }
    }
    if (statusMethod) {
      if (paymentVal === 'None') statusMethod.textContent = 'None';
      else if (paymentVal === 'PromptPay') statusMethod.textContent = 'PromptPay QR Code';
      else if (paymentVal === 'Bank Transfer') statusMethod.textContent = 'Bank Transfer (Manual)';
      else if (paymentVal === 'TrueMoney') statusMethod.textContent = 'TrueMoney Wallet';
      else statusMethod.textContent = paymentVal;
    }

    // Reactive update of plan card buttons
    updateActivePlanButtons();

    // Update inventory table columns/gating reactively based on plan change
    if (typeof applyInventoryFilters === 'function') {
      applyInventoryFilters();
    }
  }

  // Save Billing Info Option
  const btnSaveBilling = document.getElementById('btn-save-billing');
  if (btnSaveBilling) {
    btnSaveBilling.addEventListener('click', () => {
      const planVal = document.getElementById('profile-plan-select').value;
      const paymentVal = document.getElementById('profile-payment-select').value;

      // Validate payment choice matching active plans
      if (planVal !== 'Free' && paymentVal === 'None') {
        alert('Warning: Please select a valid payment method for your paid postpaid subscription plan.');
        return;
      }

      // Sync Top-nav account badge
      const badge = document.querySelector('.user-profile-badge');
      if (badge) {
        badge.textContent = `${planVal} Tier`;
      }

      // Update the status display card
      updateSubscriptionStatusDisplay();

      alert(`Success: Subscription plan saved!\nBilling Tier: ${planVal} Plan\nPayment Method: ${paymentVal}\nBilling Model: Postpay (Monthly Cycles)`);
    });
  }

  // Register change listeners on plan and payment selects to update display card in real time
  const planSelectEl = document.getElementById('profile-plan-select');
  const paySelectEl = document.getElementById('profile-payment-select');
  if (planSelectEl) planSelectEl.addEventListener('change', updateSubscriptionStatusDisplay);
  if (paySelectEl) paySelectEl.addEventListener('change', updateSubscriptionStatusDisplay);

  // Initial calls to sync status card and render plans grid on page load
  updateSubscriptionStatusDisplay();
  renderDashboardSubscriptionPlans();

  // Cancel Subscription Option
  const btnCancelSub = document.getElementById('btn-cancel-sub');
  if (btnCancelSub) {
    btnCancelSub.addEventListener('click', () => {
      if (confirm('Are you sure you want to cancel your paid subscription? You will be downgraded to the Free Tier immediately.')) {
        document.getElementById('profile-plan-select').value = 'Free';
        document.getElementById('profile-payment-select').value = 'None';
        
        // Sync badge
        const badge = document.querySelector('.user-profile-badge');
        if (badge) {
          badge.textContent = `Free Tier`;
        }

        alert('Success: Postpaid subscription cancelled.\nYour merchant workspace has reverted to the Free Tier. Outstanding fees for the active usage cycle will be calculated and invoiced.');
      }
    });
  }

  // Delete Account Option (Conditional)
  const btnDeleteAccountProfile = document.getElementById('btn-delete-account');
  if (btnDeleteAccountProfile) {
    btnDeleteAccountProfile.addEventListener('click', () => {
      const currentPlan = document.getElementById('profile-plan-select').value;

      if (currentPlan !== 'Free') {
        alert('Error: Account deletion blocked.\nYou cannot delete your account while you have an active paid subscription. Please cancel your postpaid subscription first.');
        return;
      }

      if (confirm('Warning: Are you sure you want to permanently delete your FinCommerce merchant account? All warehouse data and mapping records will be purged immediately.')) {
        const passwordPrompt = prompt('Please enter your password to confirm identity and complete account deletion:');
        if (passwordPrompt) {
          alert('Success: Merchant workspace successfully deleted. Redirecting you back to login portal.');
          localStorage.clear();
          // Redirect to login page
          window.location.href = 'index.html';
        }
      }
    });
  }

  // Live password auditor inside profile
  const profileNewPass = document.getElementById('profile-new-pass');
  const profileConfirmPass = document.getElementById('profile-confirm-pass');
  const profileStrengthMsg = document.getElementById('profile-pass-strength-msg');
  const profileBars = [
    document.getElementById('prof-bar-1'),
    document.getElementById('prof-bar-2'),
    document.getElementById('prof-bar-3')
  ];

  if (profileNewPass) {
    profileNewPass.addEventListener('input', () => {
      const pass = profileNewPass.value;
      let score = 0;

      if (pass.length >= 8) score++;
      if (/[A-Z]/.test(pass) && /[a-z]/.test(pass)) score++;
      if (/[0-9]/.test(pass) || /[^A-Za-z0-9]/.test(pass)) score++;

      // Auditing against leaked passwords list
      const leakedList = ["password123", "12345678", "qwertyuiop", "admin123", "love1234"];
      const isLeaked = leakedList.includes(pass.toLowerCase());

      profileBars.forEach(bar => { if (bar) bar.style.backgroundColor = '#e2e8f0'; });

      if (pass.length === 0) {
        profileStrengthMsg.textContent = 'Strength: Empty';
        profileStrengthMsg.style.color = 'var(--color-text-muted)';
      } else if (isLeaked) {
        profileStrengthMsg.textContent = '⚠️ CRITICAL: Password found in public breaches!';
        profileStrengthMsg.style.color = 'var(--color-error)';
        if (profileBars[0]) profileBars[0].style.backgroundColor = 'var(--color-error)';
      } else if (score === 1) {
        profileStrengthMsg.textContent = 'Weak';
        profileStrengthMsg.style.color = 'var(--color-error)';
        if (profileBars[0]) profileBars[0].style.backgroundColor = 'var(--color-error)';
      } else if (score === 2) {
        profileStrengthMsg.textContent = 'Fair';
        profileStrengthMsg.style.color = 'var(--color-warning)';
        if (profileBars[0]) profileBars[0].style.backgroundColor = 'var(--color-warning)';
        if (profileBars[1]) profileBars[1].style.backgroundColor = 'var(--color-warning)';
      } else if (score === 3) {
        profileStrengthMsg.textContent = 'Strong';
        profileStrengthMsg.style.color = 'var(--color-success)';
        profileBars.forEach(bar => { if (bar) bar.style.backgroundColor = 'var(--color-success)'; });
      }
    });
  }

  const profilePasswordForm = document.getElementById('profile-password-form');
  if (profilePasswordForm) {
    profilePasswordForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const nPass = profileNewPass.value;
      const cPass = profileConfirmPass.value;

      const leakedList = ["password123", "12345678", "qwertyuiop", "admin123", "love1234"];
      if (leakedList.includes(nPass.toLowerCase())) {
        alert('Security Block: Password has been leaked in public breaches. Choose a secure alternative.');
        return;
      }

      if (nPass !== cPass) {
        alert('Error: Confirm password does not match.');
        return;
      }

      alert('Success: Credentials updated successfully! WebSocket tokens regenerated.');
      profilePasswordForm.reset();
      profileStrengthMsg.textContent = 'Strength: Empty';
      profileStrengthMsg.style.color = 'var(--color-text-muted)';
      profileBars.forEach(bar => { if (bar) bar.style.backgroundColor = '#e2e8f0'; });
    });
  }


  // ==========================================
  // SECTION 6: IN-APP AI HELP CHATBOT
  // ==========================================

  const chatbotBubble = document.getElementById('chatbot-bubble');
  const chatbotWindow = document.getElementById('chatbot-window');
  const chatbotClose = document.getElementById('chatbot-close');
  const chatbotForm = document.getElementById('chatbot-input-form');
  const chatbotInput = document.getElementById('chatbot-text-input');
  const chatbotMessages = document.getElementById('chatbot-messages');

  if (chatbotBubble && chatbotWindow) {
    chatbotBubble.addEventListener('click', () => {
      const isVisible = chatbotWindow.style.display === 'flex';
      chatbotWindow.style.display = isVisible ? 'none' : 'flex';
      if (!isVisible && chatbotMessages) {
        chatbotMessages.scrollTop = chatbotMessages.scrollHeight;
      }
    });
  }

  if (chatbotClose) {
    chatbotClose.addEventListener('click', () => {
      chatbotWindow.style.display = 'none';
    });
  }

  if (chatbotForm) {
    chatbotForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const q = chatbotInput.value.trim();
      if (!q) return;

      // Append User message
      appendChatMessage(q, 'user');
      chatbotInput.value = '';

      // Generate bot response
      setTimeout(() => {
        const botResponse = generateBotAnswer(q);
        appendChatMessage(botResponse, 'bot');
      }, 500);
    });
  }

  function appendChatMessage(text, sender) {
    if (!chatbotMessages) return;

    const div = document.createElement('div');
    if (sender === 'user') {
      div.style.background = 'var(--color-primary)';
      div.style.color = '#ffffff';
      div.style.padding = '0.6rem 0.8rem';
      div.style.borderRadius = '12px 12px 0 12px';
      div.style.maxWidth = '85%';
      div.style.alignSelf = 'flex-end';
      div.style.lineHeight = '1.3';
    } else {
      div.style.background = '#e2e8f0';
      div.style.color = 'var(--color-text-main)';
      div.style.padding = '0.6rem 0.8rem';
      div.style.borderRadius = '12px 12px 12px 0';
      div.style.maxWidth = '85%';
      div.style.alignSelf = 'flex-start';
      div.style.lineHeight = '1.3';
    }

    div.innerHTML = text;
    chatbotMessages.appendChild(div);
    chatbotMessages.scrollTop = chatbotMessages.scrollHeight;
  }

  function generateBotAnswer(query) {
    const text = query.toLowerCase();

    if (text.includes('batch') || text.includes('excel') || text.includes('bulk') || text.includes('csv') || text.includes('template')) {
      return `<strong>Bulk Excel Upload Guide:</strong><br>
              1. Go to the <strong>Batch Upload Listing</strong> tab.<br>
              2. Download the empty template using the <strong>Download Template (.csv)</strong> button.<br>
              3. Populate your rows (headers: <code>master_sku</code>, <code>product_name</code>, <code>stock_level</code>, <code>selling_price</code>).<br>
              4. Configure your sync shops check boxes, then drop the sheet in the upload block.`;
    }

    if (text.includes('manual') || text.includes('upload') || text.includes('create') || text.includes('publish') || text.includes('single')) {
      return `<strong>Manual Product Publishing:</strong><br>
              1. Go to the <strong>Stock & SKU Mappings</strong> tab.<br>
              2. Locate the <strong>Multi-Channel Publisher</strong> form card on the right side.<br>
              3. Enter title, stock count, and price.<br>
              4. Select platforms (Shopee, Lazada, TikTok Shop) and click <strong>Publish</strong>.`;
    }

    if (text.includes('connect') || text.includes('shopee') || text.includes('lazada') || text.includes('tiktok') || text.includes('oauth')) {
      return `<strong>Connecting Platform Stores:</strong><br>
              1. Navigate to the <strong>Channel Connections</strong> tab.<br>
              2. Click <strong>Re-auth Store</strong> beside Shopee, Lazada, or TikTok Shop.<br>
              3. Follow the secure OAuth gateway to log in and authorize sync scopes.`;
    }

    if (text.includes('delete') || text.includes('retract') || text.includes('remove')) {
      return `<strong>Retracting Products:</strong><br>
              1. Go to <strong>Stock & SKU Mappings</strong>.<br>
              2. Click the 🗑️ <strong>Del</strong> button next to the SKU row.<br>
              3. Check the shop checkboxes if you wish to automatically retract listings from connected shops, and confirm.`;
    }

    if (text.includes('plan') || text.includes('price') || text.includes('billing') || text.includes('subscription')) {
      return `<strong>Pricing Plans & Billing:</strong><br>
              We offer four tiers:
              <br>• <strong>Free Tier</strong> (฿0/mo): 1 linked shop, 50 central SKUs
              <br>• <strong>Basic Tier</strong> (฿599/mo): 2 linked shops, 500 central SKUs
              <br>• <strong>Advance Tier</strong> (฿1,299/mo): Unlimited shops, unlimited SKUs
              <br>• <strong>Ultra Tier</strong> (฿2,990/mo): Everything in Advance + Strategic Calculator & Accounting
              <br>Select your plan in the <strong>Merchant Profile -> Subscription</strong> section.`;
    }

    return `I'm not sure I understand. I can help you with:<br>
            • <em>"how to batch upload"</em><br>
            • <em>"how to publish manually"</em><br>
            • <em>"how to connect stores"</em><br>
            • <em>"pricing plans"</em>`;
  }

  // ==========================================
  // SECTION 7: PAYMENT/PAYOUT TRACKING LEDGER
  // ==========================================

  let payoutLedgerItems = [
    { orderId: 'ORD-2026-9901', platform: 'Shopee', payoutDate: '2026-07-18', gross: 550.00, fees: 38.50, status: 'Settled' },
    { orderId: 'ORD-2026-9902', platform: 'Lazada', payoutDate: '2026-07-20', gross: 1200.00, fees: 96.00, status: 'Pending' },
    { orderId: 'ORD-2026-9903', platform: 'TikTok', payoutDate: '2026-07-21', gross: 450.00, fees: 22.50, status: 'Pending' },
    { orderId: 'ORD-2026-9904', platform: 'Shopee', payoutDate: '2026-07-22', gross: 890.00, fees: 62.30, status: 'Pending' },
    { orderId: 'ORD-2026-9905', platform: 'Lazada', payoutDate: '2026-07-15', gross: 1500.00, fees: 120.00, status: 'Settled' },
    { orderId: 'ORD-2026-9906', platform: 'TikTok', payoutDate: '2026-07-23', gross: 690.00, fees: 34.50, status: 'On Hold' },
    { orderId: 'ORD-2026-9907', platform: 'Shopee', payoutDate: '2026-07-24', gross: 310.00, fees: 21.70, status: 'Pending' }
  ];

  const ledgerTableBody = document.getElementById('ledger-table-body');
  const ledgerSearch = document.getElementById('ledger-search');
  const ledgerStatusFilter = document.getElementById('ledger-status-filter');
  
  const ledgerFilterShopee = document.getElementById('ledger-filter-shopee');
  const ledgerFilterLazada = document.getElementById('ledger-filter-lazada');
  const ledgerFilterTiktok = document.getElementById('ledger-filter-tiktok');
  
  const ledgerPendingAmount = document.getElementById('ledger-pending-amount');

  function renderPayoutLedger(items = payoutLedgerItems) {
    if (!ledgerTableBody) return;
    ledgerTableBody.innerHTML = '';

    if (items.length === 0) {
      ledgerTableBody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:1.5rem; color:var(--color-text-muted);">No transaction payouts match criteria.</td></tr>`;
      return;
    }

    items.forEach(item => {
      const net = item.gross - item.fees;
      const tr = document.createElement('tr');

      let statusBadge = '';
      if (item.status === 'Settled') {
        statusBadge = `<span class="status-badge" style="background: rgba(16, 185, 129, 0.1); color: var(--color-success); border-color: rgba(16, 185, 129, 0.2); font-weight:600; font-size:0.7rem; padding:0.2rem 0.4rem; border-radius:6px;">Settled</span>`;
      } else if (item.status === 'Pending') {
        statusBadge = `<span class="status-badge" style="background: rgba(245, 158, 11, 0.1); color: var(--color-warning); border-color: rgba(245, 158, 11, 0.2); font-weight:600; font-size:0.7rem; padding:0.2rem 0.4rem; border-radius:6px;">Pending</span>`;
      } else {
        statusBadge = `<span class="status-badge" style="background: rgba(239, 68, 68, 0.1); color: var(--color-error); border-color: rgba(239, 68, 68, 0.2); font-weight:600; font-size:0.7rem; padding:0.2rem 0.4rem; border-radius:6px;">On Hold</span>`;
      }

      tr.innerHTML = `
        <td style="font-weight:600; color:var(--color-text-main);">${item.orderId}</td>
        <td style="font-weight:500;">${item.platform} TH</td>
        <td>${item.payoutDate}</td>
        <td>฿${item.gross.toFixed(2)}</td>
        <td style="color:var(--color-error);">-฿${item.fees.toFixed(2)}</td>
        <td style="font-weight:600; color:var(--color-success);">฿${net.toFixed(2)}</td>
        <td style="text-align: center;">${statusBadge}</td>
      `;

      ledgerTableBody.appendChild(tr);
    });

    // Re-aggregate pending payouts sum based on filtered rows
    let pendingSum = 0;
    items.forEach(item => {
      if (item.status === 'Pending') {
        pendingSum += (item.gross - item.fees);
      }
    });
    if (ledgerPendingAmount) {
      ledgerPendingAmount.textContent = '฿' + pendingSum.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
  }

  function filterLedger() {
    const query = ledgerSearch ? ledgerSearch.value.trim().toLowerCase() : '';
    const statusVal = ledgerStatusFilter ? ledgerStatusFilter.value : 'ALL';
    
    const showShopee = ledgerFilterShopee ? ledgerFilterShopee.checked : true;
    const showLazada = ledgerFilterLazada ? ledgerFilterLazada.checked : true;
    const showTiktok = ledgerFilterTiktok ? ledgerFilterTiktok.checked : true;

    const filtered = payoutLedgerItems.filter(item => {
      const matchQuery = item.orderId.toLowerCase().includes(query);
      const matchStatus = (statusVal === 'ALL' || item.status === statusVal);
      
      let matchPlatform = false;
      if (item.platform === 'Shopee' && showShopee) matchPlatform = true;
      if (item.platform === 'Lazada' && showLazada) matchPlatform = true;
      if (item.platform === 'TikTok' && showTiktok) matchPlatform = true;

      return matchQuery && matchStatus && matchPlatform;
    });

    renderPayoutLedger(filtered);
  }

  if (ledgerSearch) ledgerSearch.addEventListener('input', filterLedger);
  if (ledgerStatusFilter) ledgerStatusFilter.addEventListener('change', filterLedger);
  if (ledgerFilterShopee) ledgerFilterShopee.addEventListener('change', filterLedger);
  if (ledgerFilterLazada) ledgerFilterLazada.addEventListener('change', filterLedger);
  if (ledgerFilterTiktok) ledgerFilterTiktok.addEventListener('change', filterLedger);

  // Initial ledger rendering
  renderPayoutLedger();


  // ==========================================
  // SECTION 8: DAILY SHIPPING & RETURNS LEDGER
  // ==========================================

  // Outbound Mock Data
  let shippingItems = [
    { 
      orderId: 'ORD-2026-9901', platform: 'Shopee', carrier: 'Flash Express', trackingCode: 'TH-FL-8890281', 
      lastCheckpoint: 'Delivered - Signed by customer', status: 'Delivered',
      milestones: [
        { time: '2026-07-16 14:30', detail: 'Delivered successfully. Receiver: Suchart S.' },
        { time: '2026-07-16 09:15', detail: 'Out for delivery with Flash rider Somchai P.' },
        { time: '2026-07-15 21:00', detail: 'Arrived at Bangkok Lak Si Sorting Hub.' },
        { time: '2026-07-14 18:00', detail: 'Package picked up from merchant warehouse.' }
      ]
    },
    { 
      orderId: 'ORD-2026-9902', platform: 'Lazada', carrier: 'J&T Express', trackingCode: 'JT-TH-0028941', 
      lastCheckpoint: 'Out for Delivery - On courier route', status: 'Out for Delivery',
      milestones: [
        { time: '2026-07-16 08:30', detail: 'Out for delivery with J&T rider.' },
        { time: '2026-07-15 23:45', detail: 'Arrived at distribution station Nonthaburi.' },
        { time: '2026-07-15 13:00', detail: 'Parcel picked up by courier.' }
      ]
    },
    { 
      orderId: 'ORD-2026-9903', platform: 'TikTok', carrier: 'Kerry Logistics', trackingCode: 'KER-TH-8890182', 
      lastCheckpoint: 'In Transit - Arrived at Central Hub', status: 'In Transit',
      milestones: [
        { time: '2026-07-16 11:20', detail: 'Arrived at Central Sorting Hub (Bangkok).' },
        { time: '2026-07-15 17:30', detail: 'Dispatched from origin warehouse.' },
        { time: '2026-07-15 11:00', detail: 'Courier pickup scheduled.' }
      ]
    },
    { 
      orderId: 'ORD-2026-9904', platform: 'Shopee', carrier: 'Ninja Van', trackingCode: 'NJV-TH-7789012', 
      lastCheckpoint: 'Pending Pickup - Manifest created', status: 'Pending Pickup',
      milestones: [
        { time: '2026-07-16 09:00', detail: 'Shipment manifest registered. Pending pickup handover.' }
      ]
    },
    { 
      orderId: 'ORD-2026-9905', platform: 'Lazada', carrier: 'Flash Express', trackingCode: 'TH-FL-1102983', 
      lastCheckpoint: 'Delivered - Left at receptionist', status: 'Delivered',
      milestones: [
        { time: '2026-07-16 12:15', detail: 'Delivered successfully. Left at lobby frontdesk.' },
        { time: '2026-07-15 08:00', detail: 'Out for delivery.' },
        { time: '2026-07-14 20:00', detail: 'Arrived at hub.' }
      ]
    },
    { 
      orderId: 'ORD-2026-9906', platform: 'TikTok', carrier: 'J&T Express', trackingCode: 'JT-TH-9902810', 
      lastCheckpoint: 'Failed - Delivery exception: Closed business', status: 'Failed / Returned',
      milestones: [
        { time: '2026-07-16 15:40', detail: 'Delivery failed: Business closed. Will re-attempt.' }
      ]
    }
  ];

  // Inbound Customer Returns Mock Data
  let returnsLedgerItems = [
    { 
      orderId: 'ORD-2026-9902', platform: 'Lazada', item: 'Premium Cotton Red T-Shirt x1', sku: 'FIN-TSHIRT-RED', 
      reason: 'Wrong size selected', carrierCode: 'J&T (RET-JT-902)', status: 'In Transit' 
    },
    { 
      orderId: 'ORD-2026-9906', platform: 'TikTok', item: 'Classic Warm Black Hoodie x1', sku: 'FIN-HOODIE-BLK', 
      reason: 'Defective zipper', carrierCode: 'Flash (RET-FL-104)', status: 'Awaiting Inspection' 
    },
    { 
      orderId: 'ORD-2026-9907', platform: 'Shopee', item: 'Premium Cotton Red T-Shirt x1', sku: 'FIN-TSHIRT-RED', 
      reason: 'Damaged package', carrierCode: 'Kerry (RET-KE-552)', status: 'Awaiting Inspection' 
    }
  ];

  // Selectors
  const shipSubtabOutbound = document.getElementById('ship-subtab-outbound');
  const shipSubtabReturns = document.getElementById('ship-subtab-returns');
  const shipViewOutbound = document.getElementById('ship-view-outbound');
  const shipViewReturns = document.getElementById('ship-view-returns');

  const shipTableBody = document.getElementById('ship-table-body');
  const returnsTableBody = document.getElementById('returns-table-body');

  const shipSearch = document.getElementById('ship-search');
  const shipCarrierFilter = document.getElementById('ship-carrier-filter');
  const shipFilterShopee = document.getElementById('ship-filter-shopee');
  const shipFilterLazada = document.getElementById('ship-filter-lazada');
  const shipFilterTiktok = document.getElementById('ship-filter-tiktok');

  // Subtab switching
  if (shipSubtabOutbound && shipSubtabReturns) {
    shipSubtabOutbound.addEventListener('click', () => {
      shipSubtabOutbound.classList.add('active');
      shipSubtabReturns.classList.remove('active');
      shipViewOutbound.classList.add('active');
      shipViewReturns.classList.remove('active');
    });

    shipSubtabReturns.addEventListener('click', () => {
      shipSubtabReturns.classList.add('active');
      shipSubtabOutbound.classList.remove('active');
      shipViewReturns.classList.add('active');
      shipViewOutbound.classList.remove('active');
    });
  }

  // Renders Outbound shipping grid
  function renderShippingProgress(items = shippingItems) {
    if (!shipTableBody) return;
    shipTableBody.innerHTML = '';

    if (items.length === 0) {
      shipTableBody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:1.5rem; color:var(--color-text-muted);">No outbound shipments match criteria.</td></tr>`;
      return;
    }

    items.forEach(item => {
      const tr = document.createElement('tr');
      let badgeStyle = "background: rgba(245, 158, 11, 0.1); color: var(--color-warning);";
      if (item.status === 'Delivered') badgeStyle = "background: rgba(16, 185, 129, 0.1); color: var(--color-success);";
      else if (item.status === 'Failed / Returned') badgeStyle = "background: rgba(239, 68, 68, 0.1); color: var(--color-error);";
      else if (item.status === 'Out for Delivery') badgeStyle = "background: rgba(139, 92, 246, 0.1); color: #8b5cf6;";
      else if (item.status === 'Pending Pickup') badgeStyle = "background: rgba(59, 130, 246, 0.1); color: #3b82f6;";

      tr.innerHTML = `
        <td style="font-weight:600; color:var(--color-text-main);">${item.orderId}</td>
        <td>${item.platform} TH</td>
        <td>${item.carrier}</td>
        <td style="font-family:monospace; font-weight:500;">${item.trackingCode}</td>
        <td style="font-size:0.7rem; color:var(--color-text-muted);">${item.lastCheckpoint}</td>
        <td style="text-align:center;"><span class="status-badge" style="${badgeStyle} border-radius:6px; padding:0.2rem 0.4rem; font-weight:600; font-size:0.65rem;">${item.status}</span></td>
        <td style="text-align:center;"><button class="btn btn-secondary" style="padding:0.25rem 0.5rem; font-size:0.65rem; margin:0;" onclick="trackParcel('${item.orderId}')">Track</button></td>
      `;
      shipTableBody.appendChild(tr);
    });

    // Recalculate metrics
    let transit = 0;
    let out = 0;
    let deliv = 0;
    items.forEach(item => {
      if (item.status === 'In Transit' || item.status === 'Pending Pickup') transit++;
      if (item.status === 'Out for Delivery') out++;
      if (item.status === 'Delivered') deliv++;
    });

    document.getElementById('ship-transit-count').textContent = transit;
    document.getElementById('ship-outfordelivery-count').textContent = out;
    document.getElementById('ship-delivered-count').textContent = deliv;
  }

  // Renders Inbound returns grid
  function renderReturnsLedger() {
    if (!returnsTableBody) return;
    returnsTableBody.innerHTML = '';

    if (returnsLedgerItems.length === 0) {
      returnsTableBody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:1.5rem; color:var(--color-text-muted);">No customer return records.</td></tr>`;
      return;
    }

    returnsLedgerItems.forEach(item => {
      const tr = document.createElement('tr');
      let statusStyle = "background: rgba(245, 158, 11, 0.1); color: var(--color-warning);";
      if (item.status === 'Refund Processed') statusStyle = "background: rgba(16, 185, 129, 0.1); color: var(--color-success);";
      else if (item.status === 'Rejected') statusStyle = "background: rgba(239, 68, 68, 0.1); color: var(--color-error);";

      let actionButton = '';
      if (item.status === 'Awaiting Inspection') {
        actionButton = `<button class="btn btn-primary" style="padding:0.25rem 0.5rem; font-size:0.65rem; margin:0; background:var(--color-secondary); border-color:var(--color-secondary);" onclick="openReturnInspection('${item.orderId}')">Inspect & Process</button>`;
      } else {
        actionButton = `<span style="font-size:0.65rem; color:var(--color-text-muted);">Audit Complete</span>`;
      }

      tr.innerHTML = `
        <td style="font-weight:600; color:var(--color-text-main);">${item.orderId}</td>
        <td>${item.platform} TH</td>
        <td style="font-weight:500;">${item.item}</td>
        <td style="font-size:0.7rem; color:var(--color-error);">${item.reason}</td>
        <td style="font-family:monospace; font-size:0.7rem;">${item.carrierCode}</td>
        <td><span class="status-badge" style="${statusStyle} border-radius:6px; padding:0.2rem 0.4rem; font-weight:600; font-size:0.65rem;">${item.status}</span></td>
        <td style="text-align:center;">${actionButton}</td>
      `;
      returnsTableBody.appendChild(tr);
    });

    // Update returns metrics
    let pendInspect = 0;
    let returnsTransit = 0;
    let refunded = 0;
    returnsLedgerItems.forEach(item => {
      if (item.status === 'Awaiting Inspection') pendInspect++;
      if (item.status === 'In Transit') returnsTransit++;
      if (item.status === 'Refund Processed') refunded++;
    });

    document.getElementById('returns-pending-count').textContent = pendInspect;
    document.getElementById('returns-transit-count').textContent = returnsTransit;
    document.getElementById('returns-refunded-count').textContent = refunded;
  }

  // Opens timeline parcel tracking modal
  window.trackParcel = function(orderId) {
    const item = shippingItems.find(s => s.orderId === orderId);
    if (!item) return;

    document.getElementById('track-modal-code').textContent = item.trackingCode;
    document.getElementById('track-modal-carrier').textContent = item.carrier;
    
    const badgeContainer = document.getElementById('track-modal-status-badge');
    let statusText = item.status;
    let badgeStyle = "background: rgba(245, 158, 11, 0.1); color: var(--color-warning);";
    if (item.status === 'Delivered') badgeStyle = "background: rgba(16, 185, 129, 0.1); color: var(--color-success);";
    else if (item.status === 'Failed / Returned') badgeStyle = "background: rgba(239, 68, 68, 0.1); color: var(--color-error);";
    else if (item.status === 'Out for Delivery') badgeStyle = "background: rgba(139, 92, 246, 0.1); color: #8b5cf6;";
    else if (item.status === 'Pending Pickup') badgeStyle = "background: rgba(59, 130, 246, 0.1); color: #3b82f6;";

    badgeContainer.innerHTML = `<span class="status-badge" style="${badgeStyle} font-weight: 600; font-size: 0.75rem; padding: 0.25rem 0.5rem; border-radius: 8px;">${statusText}</span>`;

    const timelineContainer = document.getElementById('track-modal-timeline');
    timelineContainer.innerHTML = '';

    item.milestones.forEach((m, idx) => {
      const step = document.createElement('div');
      step.style.position = 'relative';
      step.style.marginBottom = '0.5rem';

      const dotColor = idx === 0 ? 'var(--color-primary)' : '#cbd5e1';
      const dot = `<span style="position: absolute; left: -26px; top: 4px; width: 10px; height: 10px; border-radius: 50%; background: ${dotColor}; border: 2px solid #fff;"></span>`;

      step.innerHTML = `
        ${dot}
        <div style="font-size:0.65rem; color:var(--color-text-muted); font-weight:600;">${m.time}</div>
        <div style="font-size:0.75rem; color:var(--color-text-main); font-weight:${idx === 0 ? '600' : '400'}; margin-top:0.15rem;">${m.detail}</div>
      `;
      timelineContainer.appendChild(step);
    });

    document.getElementById('shipping-track-modal').classList.add('active');
  };

  // Close timeline modal
  const shipTrackClose = document.getElementById('shipping-track-close');
  if (shipTrackClose) {
    shipTrackClose.addEventListener('click', () => {
      document.getElementById('shipping-track-modal').classList.remove('active');
    });
  }

  // Opens return quality inspection modal
  let activeInspectOrderId = '';
  window.openReturnInspection = function(orderId) {
    const item = returnsLedgerItems.find(r => r.orderId === orderId);
    if (!item) return;

    activeInspectOrderId = orderId;
    document.getElementById('inspect-modal-order').textContent = item.orderId;
    document.getElementById('inspect-modal-item').textContent = item.item;
    document.getElementById('inspect-modal-reason').textContent = item.reason;

    // Reset checklist boxes
    document.getElementById('chk-inspect-packaging').checked = false;
    document.getElementById('chk-inspect-sku').checked = false;
    document.getElementById('chk-inspect-wear').checked = false;

    document.getElementById('return-inspect-modal').classList.add('active');
  };

  // Close inspection modal
  const returnInspectClose = document.getElementById('return-inspect-close');
  if (returnInspectClose) {
    returnInspectClose.addEventListener('click', () => {
      document.getElementById('return-inspect-modal').classList.remove('active');
    });
  }

  // Verification Form Submit (Approve & Restock)
  const returnVerificationForm = document.getElementById('return-verification-form');
  if (returnVerificationForm) {
    returnVerificationForm.addEventListener('submit', (e) => {
      e.preventDefault();
      
      const item = returnsLedgerItems.find(r => r.orderId === activeInspectOrderId);
      if (!item) return;

      // Update return ledger status
      item.status = 'Refund Processed';

      // restock inventory items dynamically
      const targetSku = item.sku;
      const invItem = inventoryItems.find(i => i.sku === targetSku);
      if (invItem) {
        invItem.stock = invItem.stock + 1;
        renderInventoryTable();
        alert(`Verification Passed!\nRefund of order has been processed to customer.\n1 unit of "${invItem.name}" restocked to inventory successfully (New stock: ${invItem.stock}).`);
      } else {
        alert('Verification Passed! Refund of order processed.');
      }

      document.getElementById('return-inspect-modal').classList.remove('active');
      renderReturnsLedger();
    });
  }

  // Reject Claim button click
  const btnRejectReturn = document.getElementById('btn-reject-return');
  if (btnRejectReturn) {
    btnRejectReturn.addEventListener('click', () => {
      if (confirm('Are you sure you want to reject this return claim? Customer will be notified of packaging dispute.')) {
        const item = returnsLedgerItems.find(r => r.orderId === activeInspectOrderId);
        if (item) {
          item.status = 'Rejected';
        }
        document.getElementById('return-inspect-modal').classList.remove('active');
        renderReturnsLedger();
        alert('Claim Rejected. Return package flagged for dispute resolution.');
      }
    });
  }

  // Outbound filter logic
  function filterShipping() {
    const query = shipSearch ? shipSearch.value.trim().toLowerCase() : '';
    const carrierVal = shipCarrierFilter ? shipCarrierFilter.value : 'ALL';
    const showShopee = shipFilterShopee ? shipFilterShopee.checked : true;
    const showLazada = shipFilterLazada ? shipFilterLazada.checked : true;
    const showTiktok = shipFilterTiktok ? shipFilterTiktok.checked : true;

    const filtered = shippingItems.filter(item => {
      const matchQuery = item.orderId.toLowerCase().includes(query) || item.trackingCode.toLowerCase().includes(query);
      const matchCarrier = (carrierVal === 'ALL' || item.carrier === carrierVal);
      
      let matchPlatform = false;
      if (item.platform === 'Shopee' && showShopee) matchPlatform = true;
      if (item.platform === 'Lazada' && showLazada) matchPlatform = true;
      if (item.platform === 'TikTok' && showTiktok) matchPlatform = true;

      return matchQuery && matchCarrier && matchPlatform;
    });

    renderShippingProgress(filtered);
  }

  if (shipSearch) shipSearch.addEventListener('input', filterShipping);
  if (shipCarrierFilter) shipCarrierFilter.addEventListener('change', filterShipping);
  if (shipFilterShopee) shipFilterShopee.addEventListener('change', filterShipping);
  if (shipFilterLazada) shipFilterLazada.addEventListener('change', filterShipping);
  if (shipFilterTiktok) shipFilterTiktok.addEventListener('change', filterShipping);

  // Initial renders
  renderShippingProgress();
  renderReturnsLedger();


  // ==========================================
  // SECTION 9: ORDER MANAGEMENT PORTAL
  // ==========================================

  let ordersList = [
    { orderId: 'ORD-2026-9901', customerName: 'Somchai Prasert', platform: 'Shopee', orderDate: '2026-07-16 10:15', amount: 550.00, paymentMethod: 'PromptPay', status: 'New Order', selected: false },
    { orderId: 'ORD-2026-9902', customerName: 'Anchalee S.', platform: 'Lazada', orderDate: '2026-07-16 11:30', amount: 1200.00, paymentMethod: 'Credit Card', status: 'New Order', selected: false },
    { orderId: 'ORD-2026-9903', customerName: 'Suchart Suksamran', platform: 'TikTok', orderDate: '2026-07-16 12:45', amount: 450.00, paymentMethod: 'TrueMoney', status: 'New Order', selected: false },
    { orderId: 'ORD-2026-9904', customerName: 'Phaisarn P.', platform: 'Shopee', orderDate: '2026-07-15 14:00', amount: 890.00, paymentMethod: 'PromptPay', status: 'Ready to Ship', selected: false },
    { orderId: 'ORD-2026-9905', customerName: 'Nipon K.', platform: 'Lazada', orderDate: '2026-07-15 16:30', amount: 1500.00, paymentMethod: 'Credit Card', status: 'Shipped', selected: false },
    { orderId: 'ORD-2026-9906', customerName: 'Vichai L.', platform: 'TikTok', orderDate: '2026-07-15 17:15', amount: 690.00, paymentMethod: 'PromptPay', status: 'Cancelled', selected: false }
  ];

  const platformCancelReasons = {
    'Shopee': [
      { code: 'OUT_OF_STOCK', text: 'Out of Stock (สินค้าหมด)' },
      { code: 'CUSTOMER_REQUEST', text: 'Customer Request (ลูกค้าขอยกเลิก)' },
      { code: 'DELIVERY_LIMITATION', text: 'Delivery Area Restriction (พื้นที่จัดส่งไม่รองรับ)' }
    ],
    'Lazada': [
      { code: 'OUT_OF_STOCK', text: 'Out of Stock (สินค้าหมด)' },
      { code: 'SOURCING_DELAY', text: 'Sourcing Delay (จัดส่งล่าช้า)' },
      { code: 'PRICING_ERROR', text: 'Pricing Error (ราคาผิดพลาด)' }
    ],
    'TikTok': [
      { code: 'OUT_OF_STOCK', text: 'Out of Stock (สินค้าหมด)' },
      { code: 'COURIER_FAILURE', text: 'Courier Pick-up Failure (ขนส่งไม่เข้ารับ)' },
      { code: 'ADDRESS_ERROR', text: 'Customer Address Error (ที่อยู่ลูกค้าไม่ถูกต้อง)' }
    ]
  };

  const ordersTableBody = document.getElementById('orders-table-body');
  const orderSearch = document.getElementById('order-search');
  const orderStatusFilter = document.getElementById('order-status-filter');
  const ordersSelectAll = document.getElementById('orders-select-all');

  const orderPrintConsole = document.getElementById('order-print-console');
  const orderPrintLogLines = document.getElementById('order-print-log-lines');
  const closePrintConsole = document.getElementById('close-print-console');

  const btnAcceptSelected = document.getElementById('btn-accept-selected');
  const btnPrintAwb = document.getElementById('btn-print-awb');
  const btnPrintInvoice = document.getElementById('btn-print-invoice');
  const btnPrintPicklist = document.getElementById('btn-print-picklist');

  const cancelOrderModal = document.getElementById('cancel-order-modal');
  const cancelOrderClose = document.getElementById('cancel-order-close');
  const btnCancelModalClose = document.getElementById('btn-cancel-modal-close');
  const cancelOrderReasonForm = document.getElementById('cancel-order-reason-form');
  const cancelReasonSelect = document.getElementById('cancel-reason-select');

  let activeCancelOrderId = '';

  function renderOrdersTable(items = ordersList) {
    if (!ordersTableBody) return;
    ordersTableBody.innerHTML = '';

    if (items.length === 0) {
      ordersTableBody.innerHTML = `<tr><td colspan="9" style="text-align:center; padding:1.5rem; color:var(--color-text-muted);">No orders found matching criteria.</td></tr>`;
      return;
    }

    items.forEach(item => {
      const tr = document.createElement('tr');
      
      let statusStyle = "background: rgba(59, 130, 246, 0.1); color: #3b82f6;";
      if (item.status === 'Ready to Ship') statusStyle = "background: rgba(245, 158, 11, 0.1); color: var(--color-warning);";
      else if (item.status === 'Shipped') statusStyle = "background: rgba(16, 185, 129, 0.1); color: var(--color-success);";
      else if (item.status === 'Cancelled') statusStyle = "background: rgba(239, 68, 68, 0.1); color: var(--color-error);";

      let actionButtons = '';
      if (item.status === 'New Order') {
        actionButtons = `
          <button class="btn btn-primary" style="padding:0.2rem 0.4rem; font-size:0.65rem; margin:0;" onclick="acceptOrder('${item.orderId}')">Accept</button>
          <button class="btn" style="padding:0.2rem 0.4rem; font-size:0.65rem; margin:0; background:var(--color-error); color:#fff; border:none;" onclick="cancelOrder('${item.orderId}')">Cancel</button>
        `;
      } else if (item.status === 'Ready to Ship') {
        actionButtons = `
          <button class="btn" style="padding:0.2rem 0.4rem; font-size:0.65rem; margin:0; background:var(--color-error); color:#fff; border:none;" onclick="cancelOrder('${item.orderId}')">Cancel</button>
        `;
      } else {
        actionButtons = `<span style="font-size:0.65rem; color:var(--color-text-muted);">Processed</span>`;
      }

      let platformStyle = "background: rgba(249, 115, 22, 0.12); color: #f97316; border: 1px solid rgba(249, 115, 22, 0.25);";
      if (item.platform === 'Lazada') platformStyle = "background: rgba(99, 102, 241, 0.12); color: #6366f1; border: 1px solid rgba(99, 102, 241, 0.25);";
      else if (item.platform === 'TikTok') {
        const isDark = document.body.classList.contains('theme-black');
        platformStyle = isDark 
          ? "background: rgba(255, 255, 255, 0.12); color: #f8fafc; border: 1px solid rgba(255, 255, 255, 0.25);" 
          : "background: rgba(0, 0, 0, 0.08); color: #111827; border: 1px solid rgba(0, 0, 0, 0.15);";
      }

      tr.innerHTML = `
        <td style="text-align:center;"><input type="checkbox" class="order-select-checkbox" data-id="${item.orderId}" ${item.selected ? 'checked' : ''}></td>
        <td style="font-weight:600; color:var(--color-text-main);">${item.orderId}</td>
        <td>${item.customerName}</td>
        <td><span class="status-badge" style="${platformStyle} border-radius:6px; padding:0.2rem 0.4rem; font-weight:600; font-size:0.65rem;">${item.platform}</span></td>
        <td>${item.platform} TH</td>
        <td>${item.orderDate}</td>
        <td>฿${item.amount.toFixed(2)}</td>
        <td>${item.paymentMethod}</td>
        <td><span class="status-badge" style="${statusStyle} border-radius:6px; padding:0.2rem 0.4rem; font-weight:600; font-size:0.65rem;">${item.status}</span></td>
        <td style="text-align:center; display:flex; gap:0.25rem; justify-content:center;">${actionButtons}</td>
      `;

      // Bind checkbox event inside loop
      const chk = tr.querySelector('.order-select-checkbox');
      if (chk) {
        chk.addEventListener('change', () => {
          item.selected = chk.checked;
        });
      }

      ordersTableBody.appendChild(tr);
    });
  }

  // Accept single order (syncs API)
  window.acceptOrder = function(orderId) {
    const order = ordersList.find(o => o.orderId === orderId);
    if (!order) return;

    let apiPath = '';
    let payload = {};
    if (order.platform === 'Shopee') {
      apiPath = 'POST /api/v1/shopee/orders/accept';
      payload = { order_id: orderId, action: 'CONFIRM_SHIPPED' };
    } else if (order.platform === 'Lazada') {
      apiPath = 'POST /api/v1/lazada/orders/pack';
      payload = { order_id: orderId, packaging_type: 'BOX_MEDIUM', carrier: 'LEL Express' };
    } else {
      apiPath = 'POST /api/v1/tiktok/orders/rts';
      payload = { order_id: orderId, handover_method: 'PICKUP' };
    }

    // Sync API log mockup
    alert(`[API Sync - ${order.platform} Open API]\nPath: ${apiPath}\nPayload: ${JSON.stringify(payload)}\n\nOrder accepted successfully and synced to platform!`);
    
    order.status = 'Ready to Ship';
    filterOrders();
  };

  // Accept multiple selected orders
  if (btnAcceptSelected) {
    btnAcceptSelected.addEventListener('click', () => {
      const selected = ordersList.filter(o => o.selected && o.status === 'New Order');
      if (selected.length === 0) {
        alert('Please select one or more "New Order" items using checkboxes.');
        return;
      }

      let shopeeIds = selected.filter(o => o.platform === 'Shopee').map(o => o.orderId);
      let lazadaIds = selected.filter(o => o.platform === 'Lazada').map(o => o.orderId);
      let tiktokIds = selected.filter(o => o.platform === 'TikTok').map(o => o.orderId);

      let logMessage = "Platform API Bulk Sync Complete:\n";
      if (shopeeIds.length > 0) logMessage += `• Shopee API: POST /api/v1/shopee/orders/bulk-accept (${shopeeIds.length} orders synced)\n`;
      if (lazadaIds.length > 0) logMessage += `• Lazada API: POST /api/v1/lazada/orders/bulk-pack (${lazadaIds.length} orders synced)\n`;
      if (tiktokIds.length > 0) logMessage += `• TikTok API: POST /api/v1/tiktok/orders/bulk-rts (${tiktokIds.length} orders synced)\n`;

      selected.forEach(o => {
        o.status = 'Ready to Ship';
        o.selected = false;
      });

      if (ordersSelectAll) ordersSelectAll.checked = false;
      alert(logMessage);
      filterOrders();
    });
  }

  // Cancel order popup triggers
  window.cancelOrder = function(orderId) {
    const order = ordersList.find(o => o.orderId === orderId);
    if (!order) return;

    activeCancelOrderId = orderId;
    document.getElementById('cancel-modal-order-id').textContent = orderId;
    document.getElementById('cancel-modal-platform').textContent = order.platform;

    // Populate dropdown with platform specific reasons
    cancelReasonSelect.innerHTML = '';
    const reasons = platformCancelReasons[order.platform];
    reasons.forEach(r => {
      const opt = document.createElement('option');
      opt.value = r.code;
      opt.textContent = r.text;
      cancelReasonSelect.appendChild(opt);
    });

    cancelOrderModal.classList.add('active');
  };

  // Close cancellation modal
  if (cancelOrderClose) cancelOrderClose.addEventListener('click', closeCancelModal);
  if (btnCancelModalClose) btnCancelModalClose.addEventListener('click', closeCancelModal);

  function closeCancelModal() {
    if (cancelOrderModal) cancelOrderModal.classList.remove('active');
  }

  // Cancel form submit (syncs API reason)
  if (cancelOrderReasonForm) {
    cancelOrderReasonForm.addEventListener('submit', (e) => {
      e.preventDefault();
      
      const order = ordersList.find(o => o.orderId === activeCancelOrderId);
      if (!order) return;

      const code = cancelReasonSelect.value;
      const text = cancelReasonSelect.options[cancelReasonSelect.selectedIndex].text;

      let apiPath = `POST /api/v1/${order.platform.toLowerCase()}/orders/cancel`;
      let payload = { order_id: order.orderId, cancellation_reason_code: code, reason_text: text };

      alert(`[API Sync - ${order.platform} Open API]\nPath: ${apiPath}\nPayload: ${JSON.stringify(payload)}\n\nCancellation dispatched and synced to platform shop!`);

      order.status = 'Cancelled';
      order.selected = false;
      closeCancelModal();
      filterOrders();
    });
  }

  // Bulk Print AWB, Invoice, Picklist simulator
  function printDocuments(docType) {
    const selected = ordersList.filter(o => o.selected);
    if (selected.length === 0) {
      alert(`Please select one or more order rows to compile and print ${docType} documents.`);
      return;
    }

    if (orderPrintConsole && orderPrintLogLines) {
      orderPrintLogLines.innerHTML = '';
      orderPrintConsole.style.display = 'block';

      let delay = 0;
      let logs = [
        `[SYSTEM] Connecting platform API document endpoints for ${selected.length} orders...`
      ];

      selected.forEach(o => {
        logs.push(`[API FETCH] GET /api/v1/${o.platform.toLowerCase()}/documents/${docType.toLowerCase()}?order_id=${o.orderId}`);
        logs.push(`[RENDER] Generating PDF page for ${o.orderId} (${o.customerName} - ${o.platform} TH)`);
      });

      logs.push(`[PRINTER] Compiling thermal spooler queue files...`);
      logs.push(`[SUCCESS] Spooled ${selected.length} pages to thermal docket printer. Print job complete.`);

      logs.forEach(line => {
        setTimeout(() => {
          const div = document.createElement('div');
          div.textContent = line;
          if (line.includes('[API FETCH]')) div.style.color = '#38bdf8';
          else if (line.includes('[SUCCESS]')) div.style.color = '#10b981';
          else if (line.includes('[PRINTER]')) div.style.color = '#f59e0b';
          
          orderPrintLogLines.appendChild(div);
          orderPrintLogLines.scrollTop = orderPrintLogLines.scrollHeight;
        }, delay);
        delay += 400;
      });
    }
  }

  if (btnPrintAwb) btnPrintAwb.addEventListener('click', () => printDocuments('AWB'));
  if (btnPrintInvoice) btnPrintInvoice.addEventListener('click', () => printDocuments('Invoice'));
  if (btnPrintPicklist) btnPrintPicklist.addEventListener('click', () => printDocuments('Picklist'));

  if (closePrintConsole) {
    closePrintConsole.addEventListener('click', () => {
      orderPrintConsole.style.display = 'none';
    });
  }

  // Filter orders
  function filterOrders() {
    const query = orderSearch ? orderSearch.value.trim().toLowerCase() : '';
    const statusVal = orderStatusFilter ? orderStatusFilter.value : 'ALL';
    const platformFilter = document.getElementById('order-platform-filter');
    const platformVal = platformFilter ? platformFilter.value : 'ALL';

    const filtered = ordersList.filter(o => {
      const matchQuery = o.orderId.toLowerCase().includes(query) || o.customerName.toLowerCase().includes(query);
      const matchStatus = (statusVal === 'ALL' || o.status === statusVal);
      const matchPlatform = (platformVal === 'ALL' || o.platform === platformVal);
      return matchQuery && matchStatus && matchPlatform;
    });

    renderOrdersTable(filtered);
  }

  if (orderSearch) orderSearch.addEventListener('input', filterOrders);
  if (orderStatusFilter) orderStatusFilter.addEventListener('change', filterOrders);
  
  const orderPlatformFilter = document.getElementById('order-platform-filter');
  if (orderPlatformFilter) orderPlatformFilter.addEventListener('change', filterOrders);

  if (ordersSelectAll) {
    ordersSelectAll.addEventListener('change', () => {
      const isChecked = ordersSelectAll.checked;
      const statusVal = orderStatusFilter ? orderStatusFilter.value : 'ALL';

      ordersList.forEach(o => {
        const matchStatus = (statusVal === 'ALL' || o.status === statusVal);
        if (matchStatus) o.selected = isChecked;
      });

      renderOrdersTable(ordersList.filter(o => {
        const matchStatus = (statusVal === 'ALL' || o.status === statusVal);
        return matchStatus;
      }));
    });
  }



  // Profile nested sub-tabs toggling (Personal vs Subscription)
  const profileSubtabPersonal = document.getElementById('profile-subtab-personal');
  const profileSubtabPlans = document.getElementById('profile-subtab-plans');
  const profileViewPersonal = document.getElementById('profile-view-personal');
  const profileViewPlans = document.getElementById('profile-view-plans');

  if (profileSubtabPersonal && profileSubtabPlans && profileViewPersonal && profileViewPlans) {
    profileSubtabPersonal.addEventListener('click', () => {
      profileSubtabPersonal.classList.add('active');
      profileSubtabPlans.classList.remove('active');
      profileViewPersonal.classList.add('active');
      profileViewPlans.classList.remove('active');
    });

    profileSubtabPlans.addEventListener('click', () => {
      profileSubtabPlans.classList.add('active');
      profileSubtabPersonal.classList.remove('active');
      profileViewPlans.classList.add('active');
      profileViewPersonal.classList.remove('active');
    });
  }

  // Strategic Calculator Paywall Gating logic
  const planSelect = document.getElementById('profile-plan-select');
  const calcPaywall = document.getElementById('calculator-paywall');
  const calcContent = document.getElementById('calculator-content');
  const btnUnlockCalc = document.getElementById('btn-unlock-calculator');

  function updateCalculatorAccess() {
    if (!planSelect || !calcPaywall || !calcContent) return;
    
    if (planSelect.value === 'Ultra') {
      calcPaywall.style.opacity = '0';
      setTimeout(() => {
        calcPaywall.style.display = 'none';
      }, 300);
      calcContent.style.filter = 'none';
      calcContent.style.pointerEvents = 'auto';
    } else {
      calcPaywall.style.display = 'flex';
      setTimeout(() => {
        calcPaywall.style.opacity = '1';
      }, 10);
      calcContent.style.filter = 'blur(4px)';
      calcContent.style.pointerEvents = 'none';
    }
  }

  // Initial check
  updateCalculatorAccess();

  // Listen to plan updates (dropdown changes)
  if (planSelect) {
    planSelect.addEventListener('change', updateCalculatorAccess);
  }

  // Bind paywall unlock button to trigger the Ultra tier checkout
  if (btnUnlockCalc) {
    btnUnlockCalc.addEventListener('click', (e) => {
      e.preventDefault();
      openCheckout('Ultra', 2990);
    });
  }

  // Merchant Help & Support Chat Synchronizer (Shared LocalStorage DB)
  let selectedMerchantTicketId = 'TKT-104';

  function getSupportTickets() {
    let tickets = localStorage.getItem('fincomm_support_tickets');
    if (!tickets) {
      tickets = [
        { id: 'TKT-104', name: 'Somchai Prasert', email: 'somchai@gmail.com', msg: 'PromptPay QR generation returned validation warning status code', status: 'Active', messages: [
          { sender: 'client', text: 'Hi support team, I tried to renew my Advance plan but the PromptPay QR modal gave a checksum verification warning.' }
        ]},
        { id: 'TKT-105', name: 'Nonglak Somboon', email: 'nonglak.somboon1@gmail.com', msg: 'How can I connect my Shopee API credentials?', status: 'Active', messages: [
          { sender: 'client', text: 'Hello! I am new here and setting up Shopee connector nodes. Do I need official developer API approvals?' }
        ]},
        { id: 'TKT-106', name: 'Suchart Bunmee', email: 'suchart.bunmee2@gmail.com', msg: 'Need a customized discount quote for 3 workspaces', status: 'Pending', messages: [
          { sender: 'client', text: 'Hi! We run three distinct merchant legal entities in Bangkok. Can you provide a consolidated Ultra tier billing rate?' }
        ]}
      ];
      localStorage.setItem('fincomm_support_tickets', JSON.stringify(tickets));
    } else {
      tickets = JSON.parse(tickets);
      // Upgrade existing tickets to ensure they have caseId property
      let changed = false;
      tickets.forEach(t => {
        if (!t.caseId) {
          if (t.id === 'TKT-104') t.caseId = 'SUB-PAY';
          else if (t.id === 'TKT-105') t.caseId = 'SHO-API';
          else t.caseId = 'OTHER';
          changed = true;
        }
      });
      if (changed) {
        localStorage.setItem('fincomm_support_tickets', JSON.stringify(tickets));
      }
    }
    return tickets;
  }

  function renderMerchantTicketList(defaultSelectId) {
    const listContainer = document.getElementById('merchant-ticket-list');
    if (!listContainer) return;

    const tickets = getSupportTickets();
    const myTickets = tickets.filter(t => t.email === 'somchai@gmail.com');

    // Check if tickets list serialization has changed to prevent layout flashing
    const serializedList = JSON.stringify(myTickets.map(t => ({ id: t.id, status: t.status, msg: t.msg })));
    if (listContainer.getAttribute('data-last-serialized') === serializedList && !defaultSelectId) {
      return;
    }
    listContainer.setAttribute('data-last-serialized', serializedList);

    listContainer.innerHTML = '';
    
    if (myTickets.length === 0) {
      listContainer.innerHTML = '<div style="text-align: center; color: var(--color-text-muted); font-size: 0.8rem; margin-top: 4rem;">No support tickets created.</div>';
      return;
    }

    if (defaultSelectId) {
      selectedMerchantTicketId = defaultSelectId;
    } else if (!selectedMerchantTicketId && myTickets.length > 0) {
      selectedMerchantTicketId = myTickets[0].id;
    }

    myTickets.forEach(t => {
      const item = document.createElement('div');
      
      const isActive = t.id === selectedMerchantTicketId;
      const borderStyle = isActive ? 'border-color: var(--color-primary); background: rgba(99, 102, 241, 0.05);' : 'border-color: var(--glass-border); background: #f8fafc;';
      
      item.setAttribute('style', `border: 1px solid; border-radius: 12px; padding: 0.75rem; cursor: pointer; transition: all 0.2s; ${borderStyle}`);
      
      // Select badge color based on status
      let badgeStyle = 'background: rgba(156, 163, 175, 0.15); color: #6b7280;';
      if (t.status === 'Active') {
        badgeStyle = 'background: rgba(16, 185, 129, 0.15); color: #10b981;';
      } else if (t.status.includes('Replied')) {
        badgeStyle = 'background: rgba(99, 102, 241, 0.15); color: var(--color-primary);';
      } else if (t.status === 'Solved') {
        badgeStyle = 'background: rgba(245, 158, 11, 0.15); color: #f59e0b;';
      }

      item.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.25rem;">
          <strong style="font-size: 0.75rem; color: var(--color-text-main);">${t.id}</strong>
          <span style="font-size: 0.6rem; font-weight: 700; padding: 0.15rem 0.4rem; border-radius: 8px; ${badgeStyle}">${t.status}</span>
        </div>
        <div style="font-size: 0.7rem; color: var(--color-text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
          ${t.msg}
        </div>
      `;

      item.addEventListener('click', () => {
        selectedMerchantTicketId = t.id;
        // Open detailed view modal
        const detailModal = document.getElementById('view-ticket-modal');
        if (detailModal) {
          detailModal.classList.add('active');
          renderViewTicketModalMessages();
        }
        renderMerchantTicketList();
      });

      listContainer.appendChild(item);
    });
  }

  function renderViewTicketModalMessages() {
    const container = document.getElementById('view-ticket-messages');
    if (!container) return;

    const title = document.getElementById('view-ticket-title');
    const subject = document.getElementById('view-ticket-subject');

    const tickets = getSupportTickets();
    const ticket = tickets.find(t => t.id === selectedMerchantTicketId);
    if (!ticket) return;

    if (title) title.textContent = `Ticket Detail: ${ticket.id} (${ticket.status})`;
    if (subject) subject.textContent = `Subject: ${ticket.msg}`;

    // Prevent rendering flicker if same messages
    const serializedMsgs = JSON.stringify(ticket.messages);
    if (container.getAttribute('data-last-serialized') === serializedMsgs) {
      return;
    }
    container.setAttribute('data-last-serialized', serializedMsgs);

    container.innerHTML = '';
    ticket.messages.forEach(m => {
      const div = document.createElement('div');
      if (m.sender === 'client') {
        div.setAttribute('style', 'max-width: 85%; background: var(--color-primary); color: #fff; font-size: 0.75rem; padding: 0.5rem 0.75rem; border-radius: 12px 12px 0 12px; align-self: flex-end; margin-bottom: 0.5rem; display: flex; flex-direction: column;');
      } else {
        div.setAttribute('style', 'max-width: 85%; background: #e2e8f0; color: var(--color-text-main); font-size: 0.75rem; padding: 0.5rem 0.75rem; border-radius: 12px 12px 12px 0; align-self: flex-start; margin-bottom: 0.5rem; display: flex; flex-direction: column;');
      }
      
      const label = m.sender === 'client' ? 'You' : 'Frank Minor (frankminor@gmail.com)';
      let contentHtml = `<div style="font-size: 0.6rem; opacity: 0.7; margin-bottom: 2px; font-weight: 600;">${label}</div><div>${m.text}</div>`;
      
      if (m.attachment) {
        const isDataUrl = m.attachment.startsWith('data:image/');
        const lowerName = (m.attachmentName || m.attachment).toLowerCase();
        const isImg = isDataUrl || lowerName.endsWith('.png') || lowerName.endsWith('.jpg') || lowerName.endsWith('.jpeg') || lowerName.endsWith('.gif');
        const displayName = m.attachmentName || m.attachment;
        if (isImg) {
          contentHtml += `
            <div style="margin-top: 6px; padding: 0.25rem 0.5rem; background: rgba(0,0,0,0.12); border-radius: 8px; font-size: 0.65rem; display: inline-flex; align-items: center; gap: 4px; width: fit-content;">
              📎 <span style="text-decoration: underline; cursor: pointer;" onclick="window.openImageModal('${m.attachment}', '${displayName}');">View ${displayName}</span>
            </div>
          `;
        } else {
          contentHtml += `
            <div style="margin-top: 6px; padding: 0.25rem 0.5rem; background: rgba(0,0,0,0.12); border-radius: 8px; font-size: 0.65rem; display: inline-flex; align-items: center; gap: 4px; width: fit-content;">
              📎 <span style="text-decoration: underline; cursor: pointer;" onclick="alert('Downloading: ${displayName}');">Download ${displayName}</span>
            </div>
          `;
        }
      }

      div.innerHTML = contentHtml;
      container.appendChild(div);
    });

    container.scrollTop = container.scrollHeight;
  }

  // Bind Detail Modal Close
  const btnCloseDetailModal = document.getElementById('view-ticket-close');
  const viewTicketModal = document.getElementById('view-ticket-modal');
  if (btnCloseDetailModal && viewTicketModal) {
    btnCloseDetailModal.addEventListener('click', () => {
      viewTicketModal.classList.remove('active');
    });
  }

  // Bind Reply Form Submission inside Detail Modal
  const viewTicketReplyForm = document.getElementById('view-ticket-reply-form');
  const viewTicketReplyInput = document.getElementById('view-ticket-reply-input');
  if (viewTicketReplyForm && viewTicketReplyInput) {
    viewTicketReplyForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const text = viewTicketReplyInput.value.trim();
      if (!text) return;

      const tickets = getSupportTickets();
      const ticket = tickets.find(t => t.id === selectedMerchantTicketId);
      if (ticket) {
        ticket.messages.push({ sender: 'client', text: text });
        ticket.status = 'Active';
        ticket.msg = text; // Update preview text
        localStorage.setItem('fincomm_support_tickets', JSON.stringify(tickets));
        
        viewTicketReplyInput.value = '';
        
        // Force redraw messages log
        const container = document.getElementById('view-ticket-messages');
        if (container) container.removeAttribute('data-last-serialized');
        renderViewTicketModalMessages();
        renderMerchantTicketList();
      }
    });
  }

  // Bind Attachment Drop Zone triggers & file selection
  const attachmentDropZone = document.getElementById('attachment-drop-zone');
  const attachmentFileInput = document.getElementById('ticket-attachment-file');
  const attachmentStatusText = document.getElementById('attachment-status-text');

  if (attachmentDropZone && attachmentFileInput) {
    attachmentDropZone.addEventListener('click', () => attachmentFileInput.click());
    
    attachmentFileInput.addEventListener('change', () => {
      if (attachmentFileInput.files.length > 0) {
        attachmentStatusText.textContent = `✓ File Selected: ${attachmentFileInput.files[0].name}`;
        attachmentStatusText.style.color = '#10b981';
      } else {
        attachmentStatusText.textContent = 'Drag & drop files here or click to select';
        attachmentStatusText.style.color = 'var(--color-text-main)';
      }
    });

    attachmentDropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      attachmentDropZone.style.borderColor = 'var(--color-primary)';
      attachmentDropZone.style.background = 'rgba(99, 102, 241, 0.04)';
    });

    attachmentDropZone.addEventListener('dragleave', () => {
      attachmentDropZone.style.borderColor = 'var(--color-border)';
      attachmentDropZone.style.background = '#f8fafc';
    });

    attachmentDropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      attachmentDropZone.style.borderColor = 'var(--color-border)';
      attachmentDropZone.style.background = '#f8fafc';
      if (e.dataTransfer.files.length > 0) {
        attachmentFileInput.files = e.dataTransfer.files;
        attachmentStatusText.textContent = `✓ File Dropped: ${attachmentFileInput.files[0].name}`;
        attachmentStatusText.style.color = '#10b981';
      }
    });
  }

  // Toggle Custom Details / Attachment block based on case selection
  const ticketCaseSelect = document.getElementById('ticket-case-select');
  const customFieldsContainer = document.getElementById('custom-issue-fields');
  const subjectInput = document.getElementById('ticket-subject-input');
  const descInput = document.getElementById('ticket-desc-input');

  if (ticketCaseSelect && customFieldsContainer) {
    // Initial sync
    const toggleFields = () => {
      const isOther = ticketCaseSelect.value === 'OTHER';
      customFieldsContainer.style.display = isOther ? 'block' : 'none';
      if (subjectInput) subjectInput.required = isOther;
      if (descInput) descInput.required = isOther;
    };
    ticketCaseSelect.addEventListener('change', toggleFields);
    toggleFields();
  }

  // Pre-defined issue descriptions
  const commonIssueDetails = {
    'SUB-PAY': {
      subject: "Subscription payment checkout failure",
      desc: "Merchant Somchai Prasert encountered a checksum validation mismatch warning during PromptPay checkout sequence."
    },
    'LAZ-SYNC': {
      subject: "Lazada API connection error / Shop sync loop failure",
      desc: "Lazada API channel connector returned credential tokens verification failure during scheduled inventory updates."
    },
    'SHO-API': {
      subject: "Shopee API credentials authorization error",
      desc: "Shopee developer integration nodes returned HTTP 403 Forbidden client signature mismatches during authentication checks."
    },
    'TIK-PUBL': {
      subject: "TikTok Shop product publishing retraction sync block",
      desc: "TikTok Shop product listings interface failed to publish or retract mapping definitions, returning retraction block codes."
    },
    'CALC-WALL': {
      subject: "Strategic Calculator gating paywall error",
      desc: "Merchant upgraded to Ultra subscription tier but Strategic Pricing Calculator continues to request payment upgrade."
    }
  };

  // Bind Create Support Ticket Form Submission (Direct Inline Form)
  const merchantOpenTicketForm = document.getElementById('merchant-open-ticket-form');
  if (merchantOpenTicketForm) {
    merchantOpenTicketForm.addEventListener('submit', (e) => {
      e.preventDefault();
      
      const caseId = ticketCaseSelect ? ticketCaseSelect.value : 'OTHER';
      let subject = '';
      let desc = '';
      let file = null;

      if (caseId === 'OTHER') {
        subject = subjectInput ? subjectInput.value.trim() : '';
        desc = descInput ? descInput.value.trim() : '';
        file = attachmentFileInput && attachmentFileInput.files.length > 0 ? attachmentFileInput.files[0] : null;
        if (!subject || !desc) return;
      } else {
        const details = commonIssueDetails[caseId];
        subject = details.subject;
        desc = details.desc;
      }

      function submitTicket(attachmentValue, attachmentFilename) {
        const tickets = getSupportTickets();
        const newId = `TKT-${Math.floor(107 + Math.random() * 890)}`;
        
        const newTicket = {
          id: newId,
          name: 'Somchai Prasert',
          email: 'somchai@gmail.com',
          msg: subject,
          status: 'Active',
          caseId: caseId,
          messages: [
            { sender: 'client', text: desc, attachment: attachmentValue, attachmentName: attachmentFilename }
          ]
        };

        tickets.push(newTicket);
        localStorage.setItem('fincomm_support_tickets', JSON.stringify(tickets));

        // Clear input fields & reset file inputs
        if (subjectInput) subjectInput.value = '';
        if (descInput) descInput.value = '';
        if (attachmentFileInput) attachmentFileInput.value = '';
        if (ticketCaseSelect) ticketCaseSelect.value = 'SUB-PAY';
        if (customFieldsContainer) {
          customFieldsContainer.style.display = 'none';
          if (subjectInput) subjectInput.required = false;
          if (descInput) descInput.required = false;
        }
        if (attachmentStatusText) {
          attachmentStatusText.textContent = 'Drag & drop files here or click to select';
          attachmentStatusText.style.color = 'var(--color-text-main)';
        }

        alert(`Success: Support ticket ${newId} (Case: ${caseId}) has been created and synced to the Super Admin!`);

        // Refresh tickets list
        renderMerchantTicketList(newId);
      }

      if (file) {
        const reader = new FileReader();
        reader.onload = function(event) {
          submitTicket(event.target.result, file.name);
        };
        reader.readAsDataURL(file);
      } else {
        submitTicket(null, null);
      }
    });
  }

  // Poll database changes every 1 second for live dashboard <-> admin sync
  setInterval(() => {
    const supportPanel = document.getElementById('panel-support');
    if (supportPanel && supportPanel.classList.contains('active')) {
      renderMerchantTicketList();
      
      // Update details modal chat if open
      const detailModal = document.getElementById('view-ticket-modal');
      if (detailModal && detailModal.classList.contains('active')) {
        renderViewTicketModalMessages();
      }
    }
  }, 1000);

  // Initial runs
  renderMerchantTicketList();

  // Initial orders render
  renderOrdersTable();
});
