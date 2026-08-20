import os
from flask import Flask, render_template, request

app = Flask(__name__, template_folder='.')

@app.route('/')
@app.route('/index.html')
def home():
    if request.host.startswith('home.'):
        return render_template('home.html')
    return render_template('index.html')

@app.route('/home')
@app.route('/home.html')
def home_page():
    return render_template('home.html')

@app.route('/login')
@app.route('/login.html')
def login():
    return render_template('login.html')

@app.route('/dashboard')
@app.route('/dashboard.html')
def dashboard():
    return render_template('dashboard.html')

@app.route('/test_portal')
@app.route('/test_portal.html')
def test_portal():
    return render_template('test_portal.html')

@app.route('/waiting_list')
@app.route('/waiting_list.html')
def waiting_list():
    return render_template('waiting_list.html')

@app.route('/fincommerce')
@app.route('/fincommerce.html')
def fincommerce():
    return render_template('fincommerce.html')

@app.route('/3dprint')
@app.route('/3dprint.html')
def print3d():
    return render_template('3dprint.html')

@app.route('/porob-online')
@app.route('/porob-online.html')
def porob_online():
    return render_template('porob-online.html')

@app.route('/register')
@app.route('/register.html')
def register():
    return render_template('register.html')

@app.route('/admin')
@app.route('/admin.html')
def admin():
    return render_template('admin.html')

@app.route('/edocman')
@app.route('/edocman.html')
def edocman():
    return render_template('edocman.html')



if __name__ == '__main__':
    # Retrieve port from environment or default to 5000
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=True)
