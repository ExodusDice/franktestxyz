# Changelog

All notable changes to the **franktest.xyz** project will be documented in this file.

## [v1.6.0] - 2026-08-04

### Added
- **SaaS Projects Registry Tab**: Installed the "Projects" tab in `dashboard.html` allowing admins to register new projects (specifying Name and Description).
- **Dynamic Tester Assignment Mapping**: Synchronized dropdown inputs in the "Tester Management" tab to load active project selections dynamically from the project database.
- **Dynamic Release Pipeline Staging**: Upgraded the sidebar release panel to support project selection. Clicking "Deploy" validates and pushes the chosen project's code pack to staging.
- **Fallback Pre-seeding**: Wired `login.html` and `dashboard.html` to pre-seed fallback project structures (`FinCommerce`, `Commerce API`, etc.) on initial page load.

## [v1.5.0] - 2026-08-04

### Added
- **Cream Color Test Portal**: Installed a light cream glassmorphism theme on `test_portal.html` by default for the tester frontend view.
- **Dynamic Tester Creation**: Added user registration controls to the "Tester Management" tab, allowing administrators to spawn new tester accounts instantly.
- **Admin Console User Management**: Added the "Admin Users" tab restricted to the highest user `sadminwa` to create and assign QA task scopes to administrative accounts.
- **Dynamic Sign-in Authentication**: Updated `login.html` to authenticate dynamically against pre-seeded and dynamically created users inside browser `localStorage`.

## [v1.3.0] - 2026-08-04

### Added
- **10 Beta Tester Accounts**: Added `tester01` through `tester10` with password `tester` (also accepts `password-tester`) routing to the beta test portal.
- **Additional Administrator Account**: Configured credentials for `sadmin` / `sadmin` routing to the main admin console dashboard.
- **FinCommerce Release Controls**: Added "Deploy for Testing" pipeline simulator and "Open Test Portal" redirect button on the admin dashboard console.
- **Tester Assignment Panel**: Implemented a "Manage Testers" tab inside the admin console to assign projects (e.g. `FinCommerce`) to specific beta tester IDs.
- **Dynamic Test Portal Scope**: Configured `test_portal.html` to dynamically read assignments from `localStorage`, scoping details to the assigned project or blocking access if `None` is assigned.
- **Documentation Updates**: Documented account configuration changes in `function_logs.md`.



## [v1.2.0] - 2026-07-29

### Added
- **Beta Tester Roles**: Configured login authentication in `login.html` for two beta accounts (`beta1`/`beta1` and `beta2`/`beta2`) routing to a custom landing workspace.
- **Dedicated Test Portal**: Designed `test_portal.html` tailored for beta testers, restricting visibility strictly to the assigned **FinCommerce** project scope.
- **Interactive Test Suites**: Built an endpoint response simulation console and local feedback logger inside the test portal environment.
- **Functional Docs Update**: Expanded `function_logs.md` detailing new credentials, role guards, and tester sandbox integrations.

## [v1.1.0] - 2026-07-29

### Added
- **Secure Beta Portal**: Created `login.html` providing a glassmorphic login screen for beta testers (credentials: `sadminwa`/`sadminwa`).
- **SaaS Test Dashboard**: Implemented `dashboard.html` for FinCommerce validation, featuring live telemetry panels, operational log registers, and sandbox simulation controls.
- **Visual Refresh**: Swapped the homepage visual with a cleaner minimal background representation (`static/images/clean_background.png`).
- **Technical Operation Logs**: Created `function_logs.md` mapping authentication triggers, session guards, and interactive module specifications for beta validation.

## [v1.0.0] - 2026-07-29

### Added
- **Core Flask Application**: Initialized the Python Flask web server structure (`app.py` and `requirements.txt`).
- **Modern Homepage Template**: Created a semantic, SEO-optimized HTML home screen template (`templates/index.html`).
- **Premium Glassmorphic CSS**: Developed a modern vanilla CSS stylesheet (`static/css/style.css`) including dark mode, glassmorphism, responsive grids, Google Fonts, and custom animations.
- **AI Hero Illustration**: Generated and added a futuristic AI welcome hero illustration (`static/images/welcome_hero.png`).
- **V1 Release Wallpaper**: Created and saved a custom high-resolution desktop wallpaper for the release (`static/images/v1_wallpaper.png`).
- **Version Control Config**: Configured remote Git tracking configuration (`.gitignore`).
- **Namecheap Hosting Entrypoint**: Added `passenger_wsgi.py` for Namecheap cPanel Python App integration.
- **Deployment Documentation**: Created `DEPLOYMENT.md` detailing step-by-step setup instructions for hosting the application on Namecheap.
- **GitHub Pages Configuration**: Added `CNAME` file pointing to `www.franktest.xyz` and moved the homepage to the root directory as a static `index.html` to support direct GitHub Pages hosting. Updated local `app.py` server paths.



