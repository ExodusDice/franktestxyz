// FinBanshee Frontend Logic

document.addEventListener('DOMContentLoaded', async () => {
  const getApiUrl = (endpoint) => {
    const base = window.location.protocol === 'file:' ? 'http://localhost:8000' : '';
    return `${base}${endpoint}`;
  };

  // Helper: retrieve query parameters
  const params = new URLSearchParams(window.location.search);
  const currentUsername = params.get('username') || localStorage.getItem('fb_username') || 'bet1';
  const currentRole = params.get('role') || localStorage.getItem('fb_role') || 'User';
  const currentTenant = params.get('tenant') || localStorage.getItem('fb_tenant') || 'beta';
  
  // Set defaults in localStorage
  localStorage.setItem('fb_username', currentUsername);
  localStorage.setItem('fb_role', currentRole);
  localStorage.setItem('fb_tenant', currentTenant);

  // Global fetch interceptor to inject Clerk tokens
  const originalFetch = window.fetch;
  window.fetch = async (input, init) => {
    const isLocalApi = typeof input === 'string' && (input.startsWith('/api') || input.includes('localhost:8000/api'));
    if (isLocalApi && window.Clerk && window.Clerk.session) {
      try {
        const token = await window.Clerk.session.getToken();
        if (token) {
          init = init || {};
          init.headers = init.headers || {};
          if (init.headers instanceof Headers) {
            init.headers.set('Authorization', `Bearer ${token}`);
          } else if (Array.isArray(init.headers)) {
            init.headers.push(['Authorization', `Bearer ${token}`]);
          } else {
            init.headers['Authorization'] = `Bearer ${token}`;
          }
        }
      } catch (err) {
        console.error("Failed to retrieve Clerk token:", err);
      }
    }
    return originalFetch(input, init);
  };

  // Load Clerk configuration and Crisp Widget dynamically
  let crispWidgetId = '';
  try {
    const configRes = await fetch(getApiUrl('/api/v1/config'));
    if (configRes.ok) {
      const configData = await configRes.json();
      crispWidgetId = configData.CRISP_WEBSITE_ID || '';
      
      // Load Crisp widget if configured
      if (crispWidgetId && crispWidgetId !== "your_crisp_website_id_here") {
        window.$crisp = []; window.CRISP_WEBSITE_ID = crispWidgetId;
        (function() {
          const d = document; const s = d.createElement("script");
          s.src = "https://client.crisp.chat/l.js"; s.async = 1;
          d.getElementsByTagName("head")[0].appendChild(s);
        })();
        console.log("[CRISP] Widget loaded successfully.");
      }
    }
  } catch (e) {
    console.warn("Backend configuration fetch failed.");
  }

  // ==========================================
  // VIEW SWITCHING (Tabs)
  // ==========================================
  const navItems = document.querySelectorAll('.nav-menu .nav-item');
  const panels = document.querySelectorAll('.section-panel, .admin-panel');

  navItems.forEach(item => {
    item.addEventListener('click', () => {
      const target = item.getAttribute('data-target');
      
      navItems.forEach(i => i.classList.remove('active'));
      panels.forEach(p => p.classList.remove('active'));
      
      item.classList.add('active');
      const targetPanel = document.getElementById(target);
      if (targetPanel) {
        targetPanel.classList.add('active');
      }
      
      // Trigger panel specific reloads
      if (target === 'panel-overview') loadDashboardOverview();
      if (target === 'panel-coa') loadChartOfAccounts();
      if (target === 'panel-ledger') loadJournalLedger();
      if (target === 'panel-invoices') loadInvoices();
      if (target === 'panel-billing') loadBillingPortal();
      if (target === 'admin-overview') loadAdminOverview();
      if (target === 'admin-users') loadAdminUsers();
      if (target === 'admin-audits') loadAdminAudits();
      if (target === 'admin-requests') loadAdminRequests();
    });
  });

  // Display current user
  const userDisplayEl = document.getElementById('nav-user-display');
  if (userDisplayEl) {
    userDisplayEl.textContent = `${currentUsername} (${currentRole})`;
  }

  // ==========================================
  // SIGN IN & REGISTER FORMS
  // ==========================================
  const signinForm = document.getElementById('signin-form');
  if (signinForm) {
    signinForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const username = document.getElementById('username').value;
      const password = document.getElementById('password').value;
      
      try {
        const res = await fetch(getApiUrl('/api/v1/auth/login'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password })
        });
        
        if (res.ok) {
          const data = await res.json();
          // Extract parameters from redirect url
          const urlObj = new URL(data.redirect_url, window.location.origin);
          localStorage.setItem('fb_username', urlObj.searchParams.get('username'));
          localStorage.setItem('fb_role', urlObj.searchParams.get('role'));
          localStorage.setItem('fb_tenant', urlObj.searchParams.get('tenant'));
          
          alert(data.message);
          window.location.href = data.redirect_url;
        } else {
          const err = await res.json();
          alert(err.detail || "Authentication failed.");
        }
      } catch (err) {
        alert("Server communication error: " + err.message);
      }
    });
  }

  const signupForm = document.getElementById('signup-form');
  if (signupForm) {
    signupForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const username = document.getElementById('reg-username').value;
      const email = document.getElementById('reg-email').value;
      const password = document.getElementById('reg-password').value;
      
      try {
        // Registers in the 'beta' workspace by default
        const res = await fetch(getApiUrl('/api/v1/users?tenant_id=beta'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username,
            password,
            email,
            role: 'User',
            package: 'Free',
            permissions: ['invoice-create', 'report-view-basic']
          })
        });
        
        if (res.ok) {
          alert("Account successfully created! Please sign in.");
          window.location.href = 'index.html';
        } else {
          const err = await res.json();
          alert(err.detail || "Registration failed.");
        }
      } catch (err) {
        alert("Server communication error: " + err.message);
      }
    });
  }

  // ==========================================
  // PANEL 1: OVERVIEW DASHBOARD
  // ==========================================
  async function loadDashboardOverview() {
    try {
      const res = await fetch(getApiUrl(`/api/v1/accounting/accounts?tenant_id=${currentTenant}`));
      if (!res.ok) return;
      const accounts = await res.json();
      
      let totalRevenue = 0;
      let totalExpense = 0;
      let cashBalance = 0;

      accounts.forEach(acct => {
        if (acct.type === 'Income') totalRevenue += acct.balance;
        if (acct.type === 'Expense') totalExpense += acct.balance;
        if (acct.id === '1010-cash') cashBalance = acct.balance;
      });

      const netIncome = totalRevenue - totalExpense;

      document.getElementById('val-revenue').textContent = `฿${totalRevenue.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}`;
      document.getElementById('val-expense').textContent = `฿${totalExpense.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}`;
      document.getElementById('val-netincome').textContent = `฿${netIncome.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}`;
      
      // Update badge
      const profileRes = await fetch(getApiUrl(`/api/v1/users?tenant_id=${currentTenant}`));
      if (profileRes.ok) {
        const users = await profileRes.json();
        const activeUser = users.find(u => u.username === currentUsername);
        if (activeUser) {
          document.getElementById('user-tier-badge').textContent = `${activeUser.package || 'Free'} Plan`;
          localStorage.setItem('fb_package', activeUser.package || 'Free');
        }
      }

      // Draw simple chart using canvas
      const canvas = document.getElementById('dashboard-chart');
      if (canvas) {
        const ctx = canvas.getContext('2d');
        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Let's set dimensions
        canvas.width = canvas.parentElement.clientWidth;
        canvas.height = 220;

        const maxVal = Math.max(totalRevenue, totalExpense, 1000);
        const revHeight = (totalRevenue / maxVal) * 150;
        const expHeight = (totalExpense / maxVal) * 150;

        // Draw grids
        ctx.strokeStyle = 'rgba(255,255,255,0.05)';
        ctx.lineWidth = 1;
        for (let i = 0; i < 5; i++) {
          const y = 30 + i * 40;
          ctx.beginPath();
          ctx.moveTo(30, y);
          ctx.lineTo(canvas.width - 30, y);
          ctx.stroke();
        }

        // Draw Revenue Bar
        ctx.fillStyle = '#10b981';
        ctx.fillRect(80, 190 - revHeight, 60, revHeight);
        ctx.fillStyle = '#ffffff';
        ctx.font = '12px Outfit';
        ctx.fillText(`Revenue (฿${totalRevenue})`, 70, 185 - revHeight);

        // Draw Expense Bar
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(200, 190 - expHeight, 60, expHeight);
        ctx.fillStyle = '#ffffff';
        ctx.fillText(`Expense (฿${totalExpense})`, 190, 185 - expHeight);

        // Draw floor line
        ctx.strokeStyle = 'rgba(255,255,255,0.2)';
        ctx.beginPath();
        ctx.moveTo(30, 190);
        ctx.lineTo(canvas.width - 30, 190);
        ctx.stroke();
      }
    } catch (e) {
      console.error(e);
    }
  }

  // ==========================================
  // PANEL 2: CHART OF ACCOUNTS (COA)
  // ==========================================
  async function loadChartOfAccounts() {
    try {
      const res = await fetch(getApiUrl(`/api/v1/accounting/accounts?tenant_id=${currentTenant}`));
      if (!res.ok) return;
      const accounts = await res.json();
      
      const tbody = document.getElementById('coa-table-body');
      tbody.innerHTML = '';
      
      accounts.forEach(acct => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td><code>${acct.id.split('-')[0]}</code></td>
          <td>${acct.name}</td>
          <td><span class="badge btn-secondary">${acct.type}</span></td>
          <td style="text-align: right; font-weight: bold; color: ${acct.balance >= 0 ? '#10b981' : '#ef4444'}">
            ฿${acct.balance.toLocaleString(undefined, {minimumFractionDigits: 2})}
          </td>
        `;
        tbody.appendChild(tr);
      });

      // Update selections in ledger accounts
      const selectBoxes = document.querySelectorAll('.ledger-acct-select');
      selectBoxes.forEach(select => {
        const val = select.value;
        select.innerHTML = '';
        accounts.forEach(acct => {
          const opt = document.createElement('option');
          opt.value = acct.id;
          opt.textContent = `${acct.id.split('-')[0]} - ${acct.name}`;
          select.appendChild(opt);
        });
        if (val) select.value = val;
      });
    } catch (e) {
      console.error(e);
    }
  }

  const coaForm = document.getElementById('coa-form');
  if (coaForm) {
    coaForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const code = document.getElementById('coa-code').value;
      const name = document.getElementById('coa-name').value;
      const type = document.getElementById('coa-type').value;

      try {
        const res = await fetch(getApiUrl(`/api/v1/accounting/accounts?tenant_id=${currentTenant}`), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code, name, type })
        });
        if (res.ok) {
          alert("Account successfully created!");
          coaForm.reset();
          loadChartOfAccounts();
        } else {
          const err = await res.json();
          alert(err.detail || "Failed to create account.");
        }
      } catch (err) {
        alert(err.message);
      }
    });
  }

  // ==========================================
  // PANEL 3: JOURNAL LEDGER
  // ==========================================
  const debitContainer = document.getElementById('debit-rows-container');
  const creditContainer = document.getElementById('credit-rows-container');

  function createLedgerRow(type) {
    const row = document.createElement('div');
    row.className = 'input-row';
    row.innerHTML = `
      <select class="form-input ledger-acct-select" required>
        <!-- Loaded dynamically -->
      </select>
      <input class="form-input" type="number" step="0.01" placeholder="Amount (฿)" required style="max-width: 120px;">
      <button type="button" class="btn-remove-row">X</button>
    `;
    
    row.querySelector('.btn-remove-row').addEventListener('click', () => {
      row.remove();
    });

    // Populate accounts list
    fetch(getApiUrl(`/api/v1/accounting/accounts?tenant_id=${currentTenant}`))
      .then(res => res.json())
      .then(accounts => {
        const select = row.querySelector('.ledger-acct-select');
        select.innerHTML = '';
        accounts.forEach(acct => {
          const opt = document.createElement('option');
          opt.value = acct.id;
          opt.textContent = `${acct.id.split('-')[0]} - ${acct.name}`;
          select.appendChild(opt);
        });
      });

    return row;
  }

  const btnAddDebit = document.getElementById('btn-add-debit');
  if (btnAddDebit) {
    btnAddDebit.addEventListener('click', () => {
      debitContainer.appendChild(createLedgerRow('debit'));
    });
  }

  const btnAddCredit = document.getElementById('btn-add-credit');
  if (btnAddCredit) {
    btnAddCredit.addEventListener('click', () => {
      creditContainer.appendChild(createLedgerRow('credit'));
    });
  }

  async function loadJournalLedger() {
    try {
      // Clear ledger row builders and pre-populate one row on each side
      if (debitContainer && debitContainer.children.length === 0) {
        debitContainer.appendChild(createLedgerRow('debit'));
      }
      if (creditContainer && creditContainer.children.length === 0) {
        creditContainer.appendChild(createLedgerRow('credit'));
      }

      const res = await fetch(getApiUrl(`/api/v1/accounting/transactions?tenant_id=${currentTenant}`));
      if (!res.ok) return;
      const txs = await res.json();

      const tbody = document.getElementById('ledger-table-body');
      tbody.innerHTML = '';

      txs.forEach(tx => {
        const debitsText = tx.debits.map(d => `Dr. ${d.account.split('-')[0]} (฿${d.amount})`).join('<br>');
        const creditsText = tx.credits.map(c => `Cr. ${c.account.split('-')[0]} (฿${c.amount})`).join('<br>');

        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${tx.date}</td>
          <td><strong>${tx.description}</strong></td>
          <td style="color: var(--color-success); font-size: 0.85rem;">${debitsText}</td>
          <td style="color: var(--color-secondary); font-size: 0.85rem;">${creditsText}</td>
          <td style="text-align: right; font-weight: bold;">฿${tx.amount.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
        `;
        tbody.appendChild(tr);
      });
    } catch (e) {
      console.error(e);
    }
  }

  const ledgerForm = document.getElementById('ledger-form');
  if (ledgerForm) {
    ledgerForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const date = document.getElementById('tx-date').value;
      const description = document.getElementById('tx-desc').value;

      const debits = [];
      debitContainer.querySelectorAll('.input-row').forEach(row => {
        debits.push({
          account: row.querySelector('select').value,
          amount: parseFloat(row.querySelector('input').value)
        });
      });

      const credits = [];
      creditContainer.querySelectorAll('.input-row').forEach(row => {
        credits.push({
          account: row.querySelector('select').value,
          amount: parseFloat(row.querySelector('input').value)
        });
      });

      try {
        const res = await fetch(getApiUrl(`/api/v1/accounting/transactions?tenant_id=${currentTenant}`), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ date, description, debits, credits })
        });

        if (res.ok) {
          alert("Journal Transaction posted successfully!");
          ledgerForm.reset();
          debitContainer.innerHTML = '';
          creditContainer.innerHTML = '';
          loadJournalLedger();
        } else {
          const err = await res.json();
          alert(err.detail || "Failed to post transaction.");
        }
      } catch (err) {
        alert(err.message);
      }
    });
  }

  // ==========================================
  // PANEL 4: INVOICES
  // ==========================================
  const modalInvoice = document.getElementById('invoice-modal');
  const btnShowInvoice = document.getElementById('btn-show-invoice-modal');
  const btnCloseInvoice = document.getElementById('btn-close-invoice-modal');
  const invoiceItemsContainer = document.getElementById('invoice-items-container');

  if (btnShowInvoice) {
    btnShowInvoice.addEventListener('click', () => {
      modalInvoice.style.display = 'flex';
      if (invoiceItemsContainer.children.length === 0) {
        addInvoiceItemRow();
      }
    });
  }

  if (btnCloseInvoice) {
    btnCloseInvoice.addEventListener('click', () => {
      modalInvoice.style.display = 'none';
    });
  }

  function addInvoiceItemRow() {
    const row = document.createElement('div');
    row.className = 'input-row';
    row.innerHTML = `
      <input class="form-input" type="text" placeholder="Item description" required style="flex: 2;">
      <input class="form-input" type="number" placeholder="Qty" required style="max-width: 80px;">
      <input class="form-input" type="number" step="0.01" placeholder="Price (฿)" required style="max-width: 110px;">
      <button type="button" class="btn-remove-row">X</button>
    `;
    row.querySelector('.btn-remove-row').addEventListener('click', () => {
      row.remove();
    });
    invoiceItemsContainer.appendChild(row);
  }

  const btnAddInvItem = document.getElementById('btn-add-invoice-item');
  if (btnAddInvItem) {
    btnAddInvItem.addEventListener('click', () => {
      addInvoiceItemRow();
    });
  }

  async function loadInvoices() {
    try {
      const res = await fetch(getApiUrl(`/api/v1/accounting/invoices?tenant_id=${currentTenant}`));
      if (!res.ok) return;
      const invs = await res.json();

      const tbody = document.getElementById('invoice-table-body');
      tbody.innerHTML = '';

      invs.forEach(inv => {
        const tr = document.createElement('tr');
        
        let statusBadge = `<span class="badge badge-warning">Unpaid</span>`;
        let actions = `
          <button class="btn btn-secondary btn-send-invoice" data-id="${inv.id}" style="padding: 0.3rem 0.6rem; font-size: 0.75rem;">Email Client</button>
          <button class="btn btn-primary btn-pay-invoice" data-id="${inv.id}" style="padding: 0.3rem 0.6rem; font-size: 0.75rem;">Mark Paid</button>
        `;

        if (inv.status === 'Paid') {
          statusBadge = `<span class="badge badge-success">Paid</span>`;
          actions = `<button class="btn btn-secondary btn-send-invoice" data-id="${inv.id}" style="padding: 0.3rem 0.6rem; font-size: 0.75rem;">Resend Email</button>`;
        }

        tr.innerHTML = `
          <td><code>${inv.id}</code></td>
          <td><strong>${inv.customer_name}</strong><br><span style="font-size:0.75rem;">${inv.customer_email}</span></td>
          <td>${inv.date}</td>
          <td>${inv.due_date}</td>
          <td style="font-weight: bold;">฿${inv.total.toLocaleString(undefined, {minimumFractionDigits:2})}</td>
          <td>${statusBadge}</td>
          <td style="text-align: right; display:flex; gap:0.5rem; justify-content:flex-end;">${actions}</td>
        `;
        tbody.appendChild(tr);
      });

      // Bind events
      document.querySelectorAll('.btn-send-invoice').forEach(btn => {
        btn.addEventListener('click', async () => {
          const id = btn.getAttribute('data-id');
          btn.textContent = "Sending...";
          btn.disabled = true;
          try {
            const sendRes = await fetch(getApiUrl(`/api/v1/accounting/invoices/${id}/send?tenant_id=${currentTenant}`), {
              method: 'POST'
            });
            if (sendRes.ok) {
              alert("Invoice successfully emailed via Resend!");
            } else {
              alert("Failed to send email. Check configuration.");
            }
          } catch (e) {
            alert(e.message);
          }
          btn.textContent = "Email Client";
          btn.disabled = false;
        });
      });

      document.querySelectorAll('.btn-pay-invoice').forEach(btn => {
        btn.addEventListener('click', async () => {
          const id = btn.getAttribute('data-id');
          try {
            const payRes = await fetch(getApiUrl(`/api/v1/accounting/invoices/${id}/pay?tenant_id=${currentTenant}`), {
              method: 'POST'
            });
            if (payRes.ok) {
              alert("Invoice marked as Paid! Ledger double-entries posted automatically.");
              loadInvoices();
            } else {
              alert("Failed to register payment.");
            }
          } catch (e) {
            alert(e.message);
          }
        });
      });

    } catch (e) {
      console.error(e);
    }
  }

  const invoiceForm = document.getElementById('create-invoice-form');
  if (invoiceForm) {
    invoiceForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const customer_name = document.getElementById('inv-cust-name').value;
      const customer_email = document.getElementById('inv-cust-email').value;
      const date = document.getElementById('inv-date').value;
      const due_date = document.getElementById('inv-due-date').value;

      const items = [];
      invoiceItemsContainer.querySelectorAll('.input-row').forEach(row => {
        const inputs = row.querySelectorAll('input');
        items.push({
          description: inputs[0].value,
          quantity: parseInt(inputs[1].value),
          unit_price: parseFloat(inputs[2].value)
        });
      });

      try {
        const res = await fetch(getApiUrl(`/api/v1/accounting/invoices?tenant_id=${currentTenant}`), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ customer_name, customer_email, date, due_date, items })
        });

        if (res.ok) {
          alert("Invoice successfully created!");
          invoiceForm.reset();
          invoiceItemsContainer.innerHTML = '';
          modalInvoice.style.display = 'none';
          loadInvoices();
        } else {
          alert("Failed to create invoice.");
        }
      } catch (err) {
        alert(err.message);
      }
    });
  }

  // ==========================================
  // PANEL 5: BILLING & STRIPE
  // ==========================================
  let selectedUpgradePlan = '';
  
  async function loadBillingPortal() {
    // Read user details from endpoint
    try {
      const res = await fetch(getApiUrl(`/api/v1/users?tenant_id=${currentTenant}`));
      if (res.ok) {
        const users = await res.json();
        const activeUser = users.find(u => u.username === currentUsername);
        if (activeUser) {
          const tier = activeUser.package || 'Free';
          document.getElementById('current-billing-tier').textContent = `${tier} Tier`;
          
          // Select current box
          document.querySelectorAll('.price-box').forEach(box => {
            box.classList.remove('selected');
          });
          const currentBox = document.getElementById(`pbox-${tier.replace(" ", "")}`);
          if (currentBox) {
            currentBox.classList.add('selected');
          }
        }
      }
    } catch (e) {
      console.error(e);
    }
  }

  document.querySelectorAll('.select-tier-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tier = btn.getAttribute('data-tier');
      if (tier === 'Free') {
        processFreeUpgrade();
        return;
      }
      
      selectedUpgradePlan = tier;
      document.getElementById('checkout-title').textContent = `Complete Checkout for Plan ${tier}`;
      
      const priceMap = { 'Standard': '฿199.00', 'Pro': '฿299.00', 'Pro Business': '฿499.00' };
      document.getElementById('checkout-price-thb').textContent = priceMap[tier];
      
      document.getElementById('stripe-checkout-card').style.display = 'block';
      document.getElementById('stripe-checkout-card').scrollIntoView({ behavior: 'smooth' });
    });
  });

  async function processFreeUpgrade() {
    try {
      const res = await fetch(getApiUrl('/api/v1/stripe/upgrade-subscription'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: `${currentUsername}@finbanshee.com`,
          plan_name: 'Free',
          payment_method: 'Bypass'
        })
      });
      if (res.ok) {
        alert("Subscription downgraded to Free.");
        loadBillingPortal();
        loadDashboardOverview();
      }
    } catch (e) {
      alert(e.message);
    }
  }

  const btnCardPay = document.getElementById('btn-submit-card-pay');
  if (btnCardPay) {
    btnCardPay.addEventListener('click', async () => {
      const cardNum = document.getElementById('fake-card-number').value;
      if (!cardNum) {
        alert("Please enter a card number.");
        return;
      }
      btnCardPay.textContent = "Processing...";
      btnCardPay.disabled = true;
      
      try {
        const intentRes = await fetch(getApiUrl('/api/v1/stripe/create-payment-intent'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            plan_name: selectedUpgradePlan,
            email: `${currentUsername}@finbanshee.com`
          })
        });
        
        if (intentRes.ok) {
          const upgradeRes = await fetch(getApiUrl('/api/v1/stripe/upgrade-subscription'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: `${currentUsername}@finbanshee.com`,
              plan_name: selectedUpgradePlan,
              payment_method: 'Stripe Credit Card (Tokenized)'
            })
          });
          
          if (upgradeRes.ok) {
            alert(`Payment Succeeded! Subscription upgraded to ${selectedUpgradePlan}`);
            document.getElementById('stripe-checkout-card').style.display = 'none';
            loadBillingPortal();
            loadDashboardOverview();
          }
        }
      } catch (err) {
        alert("Payment gateway error: " + err.message);
      }
      
      btnCardPay.textContent = "Pay via Card";
      btnCardPay.disabled = false;
    });
  }

  const btnQRSimulate = document.getElementById('btn-simulate-qr-paid');
  if (btnQRSimulate) {
    btnQRSimulate.addEventListener('click', async () => {
      btnQRSimulate.textContent = "Verifying QR...";
      btnQRSimulate.disabled = true;
      
      try {
        const upgradeRes = await fetch(getApiUrl('/api/v1/stripe/upgrade-subscription'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: `${currentUsername}@finbanshee.com`,
            plan_name: selectedUpgradePlan,
            payment_method: 'Stripe PromptPay (Thai QR code)'
          })
        });
        
        if (upgradeRes.ok) {
          alert(`PromptPay QR scan verified! Subscribed to ${selectedUpgradePlan}`);
          document.getElementById('stripe-checkout-card').style.display = 'none';
          loadBillingPortal();
          loadDashboardOverview();
        }
      } catch (err) {
        alert(err.message);
      }
      btnQRSimulate.textContent = "Simulate QR Paid";
      btnQRSimulate.disabled = false;
    });
  }

  // ==========================================
  // PANEL 6: DIAGNOSTICS & SENTRY
  // ==========================================
  const btnTriggerSentry = document.getElementById('btn-trigger-sentry');
  if (btnTriggerSentry) {
    btnTriggerSentry.addEventListener('click', async () => {
      try {
        const res = await fetch(getApiUrl('/api/v1/debug-sentry'));
        alert("Unexpected success? Status: " + res.status);
      } catch (e) {
        alert("Triggered divide-by-zero error on backend! Confirm Sentry log outputs.");
      }
    });
  }

  const deleteForm = document.getElementById('delete-account-form');
  if (deleteForm) {
    deleteForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const reason = document.getElementById('del-reason').value;
      
      try {
        const res = await fetch(getApiUrl('/api/v1/users/delete-request'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            clerk_user_id: 'clerk_mock_id_here',
            email: `${currentUsername}@finbanshee.com`,
            name: currentUsername,
            reason: reason
          })
        });
        
        if (res.ok) {
          alert("Deletion request sent! An admin will review it.");
          deleteForm.reset();
        } else {
          alert("Failed to submit request.");
        }
      } catch (err) {
        alert(err.message);
      }
    });
  }

  // ==========================================
  // ADMIN CONSOLE ACTIONS
  // ==========================================
  async function loadAdminOverview() {
    try {
      const res = await fetch(getApiUrl('/api/v1/users?tenant_id=admin'));
      if (res.ok) {
        const adminUsers = await res.json();
        const betaUsers = await fetch(getApiUrl('/api/v1/users?tenant_id=beta')).then(r => r.json());
        
        const total = adminUsers.length + betaUsers.length;
        document.getElementById('admin-stat-users').textContent = total;
      }
      
      // Load email counter
      const configRes = await fetch(getApiUrl('/api/v1/config'));
      if (configRes.ok) {
        // Mock email outbox stats or load from email log
        document.getElementById('admin-stat-emails').textContent = `0 / 3000`;
      }
    } catch (e) {
      console.error(e);
    }
  }

  async function loadAdminUsers() {
    try {
      const tbody = document.getElementById('admin-users-table-body');
      tbody.innerHTML = '';

      // Load admin tenant users
      const admins = await fetch(getApiUrl('/api/v1/users?tenant_id=admin')).then(r => r.json());
      // Load beta tenant users
      const betas = await fetch(getApiUrl('/api/v1/users?tenant_id=beta')).then(r => r.json());

      const all = [
        ...admins.map(u => ({ ...u, tenant: 'admin' })),
        ...betas.map(u => ({ ...u, tenant: 'beta' }))
      ];

      all.forEach(u => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td><code>${u.username}</code></td>
          <td>${u.email}</td>
          <td><code>${u.tenant}</code></td>
          <td>${u.role}</td>
          <td><strong>${u.package || 'Free'}</strong></td>
          <td><span class="badge badge-success">${u.status || 'Active'}</span></td>
          <td style="text-align: right;">
            <select class="form-input select-change-pkg" data-username="${u.username}" data-tenant="${u.tenant}" style="width: auto; padding: 0.2rem; font-size: 0.8rem; height: auto;">
              <option value="Free" ${u.package === 'Free' ? 'selected' : ''}>Free</option>
              <option value="Standard" ${u.package === 'Standard' ? 'selected' : ''}>Standard</option>
              <option value="Pro" ${u.package === 'Pro' ? 'selected' : ''}>Pro</option>
              <option value="Pro Business" ${u.package === 'Pro Business' ? 'selected' : ''}>Pro Business</option>
            </select>
          </td>
        `;
        tbody.appendChild(tr);
      });

      // Bind package changes
      document.querySelectorAll('.select-change-pkg').forEach(select => {
        select.addEventListener('change', async () => {
          const username = select.getAttribute('data-username');
          const tenant = select.getAttribute('data-tenant');
          const newPkg = select.value;
          
          try {
            const res = await fetch(getApiUrl('/api/v1/stripe/upgrade-subscription'), {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                email: `${username}@finbanshee.com`,
                plan_name: newPkg,
                payment_method: 'Admin Panel Override'
              })
            });
            if (res.ok) {
              alert(`Package for user ${username} updated successfully!`);
              loadAdminUsers();
            }
          } catch (e) {
            alert(e.message);
          }
        });
      });
    } catch (e) {
      console.error(e);
    }
  }

  async function loadAdminAudits() {
    try {
      const res = await fetch(getApiUrl('/api/v1/users/audit-logs?tenant_id=admin'));
      if (!res.ok) return;
      const logs = await res.json();

      const tbody = document.getElementById('admin-audits-table-body');
      tbody.innerHTML = '';

      logs.forEach(l => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td><small>${new Date(l.timestamp).toLocaleString()}</small></td>
          <td><code>${l.username}</code></td>
          <td><strong>${l.action}</strong></td>
          <td style="text-align: right; font-size: 0.8rem; color: var(--color-text-muted);">${l.details}</td>
        `;
        tbody.appendChild(tr);
      });
    } catch (e) {
      console.error(e);
    }
  }

  async function loadAdminRequests() {
    // Loads pending deletion requests
    const tbody = document.getElementById('admin-requests-table-body');
    tbody.innerHTML = '';
    
    // Simulates listing requests
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><code>del-req-x92</code></td>
      <td>Somchai Store</td>
      <td>somchai@gmail.com</td>
      <td><code>user_mock_clerk_id</code></td>
      <td><span class="badge badge-warning">Pending</span></td>
      <td style="text-align: right;">
        <button class="btn btn-danger btn-approve-del" style="padding: 0.3rem 0.6rem; font-size: 0.75rem;">Approve Deletion</button>
      </td>
    `;
    tbody.appendChild(tr);

    tr.querySelector('.btn-approve-del').addEventListener('click', () => {
      alert("Account deletion approved and completed. Users tables purged.");
      tr.remove();
    });
  }

  // Admin create custom user
  const adminCreateUserForm = document.getElementById('admin-create-user-form');
  const userModal = document.getElementById('user-modal');
  const btnShowUserModal = document.getElementById('btn-show-user-modal');
  const btnCloseUserModal = document.getElementById('btn-close-user-modal');

  if (btnShowUserModal) {
    btnShowUserModal.addEventListener('click', () => {
      userModal.style.display = 'flex';
    });
  }

  if (btnCloseUserModal) {
    btnCloseUserModal.addEventListener('click', () => {
      userModal.style.display = 'none';
    });
  }

  if (adminCreateUserForm) {
    adminCreateUserForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const username = document.getElementById('adm-usr-username').value;
      const email = document.getElementById('adm-usr-email').value;
      const password = document.getElementById('adm-usr-password').value;
      const tenant = document.getElementById('adm-usr-tenant').value;
      const role = document.getElementById('adm-usr-role').value;
      const pkg = document.getElementById('adm-usr-package').value;

      try {
        const res = await fetch(getApiUrl(`/api/v1/users?tenant_id=${tenant}`), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username,
            password,
            email,
            role,
            package: pkg,
            permissions: ['invoice-create', 'report-view-basic']
          })
        });

        if (res.ok) {
          alert("Account successfully provisioned!");
          adminCreateUserForm.reset();
          userModal.style.display = 'none';
          loadAdminUsers();
        } else {
          alert("Failed to provision account.");
        }
      } catch (err) {
        alert(err.message);
      }
    });
  }

  // Logout actions
  const btnLogout = document.getElementById('btn-logout');
  if (btnLogout) {
    btnLogout.addEventListener('click', () => {
      localStorage.clear();
      window.location.href = 'index.html';
    });
  }

  const btnAdminLogout = document.getElementById('btn-admin-logout');
  if (btnAdminLogout) {
    btnAdminLogout.addEventListener('click', () => {
      localStorage.clear();
      window.location.href = 'index.html';
    });
  }

  // Initialize view displays
  const pathname = window.location.pathname;
  if (pathname.includes('dashboard.html')) {
    loadDashboardOverview();
  } else if (pathname.includes('admin.html')) {
    loadAdminOverview();
  }
});
