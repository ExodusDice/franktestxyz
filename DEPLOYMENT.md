# Deploying to Namecheap cPanel

Follow these steps to set up and run the Python Flask application on Namecheap Shared Hosting:

## Step 1: Upload Your Files
Upload the repository files to your Namecheap account (you can clone using Git Version Control in cPanel, or upload via FTP/File Manager).
- We recommend placing the files in a folder like `/home/username/franktest.xyz/` (outside the `public_html` directory for better security).

## Step 2: Create Python App in cPanel
1. Log in to your **Namecheap cPanel**.
2. Search for and click on **Setup Python App** (under the *Software* section).
3. Click **Create Application**.
4. Configure the following fields:
   - **Python version**: Select the latest version available (e.g. `3.11` or `3.12`).
   - **Application root**: Enter the folder name where you uploaded the files (e.g., `franktest.xyz`).
   - **Application URL**: Select `http://www.franktest.xyz` (or `http://franktest.xyz`).
   - **Application startup file**: Type `passenger_wsgi.py`.
   - **Application Entry point**: Type `application`.
5. Click **Create** in the top-right corner.

## Step 3: Install Dependencies
1. Scroll down to the **Configuration files** section in the Python App screen.
2. In the text box, type `requirements.txt` and click **Add**.
3. Click the **Run Pip Install** button next to `requirements.txt` to install `Flask` and other dependencies.

## Step 4: Restart the Application
- Click the **Restart** button at the top of the Python App page.
- Visit `http://www.franktest.xyz` to verify your home screen is live!
