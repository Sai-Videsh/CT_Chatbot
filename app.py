import os
import json
from dotenv import load_dotenv
from flask import Flask, render_template, request, jsonify
from flask_cors import CORS
import google.generativeai as genai
from uuid import uuid4

load_dotenv()

app = Flask(__name__)
CORS(app)

# Configure Gemini API key
api_key = os.getenv("GEMINI_API_KEY")
if not api_key:
    raise ValueError("GEMINI_API_KEY is not set in .env file")
genai.configure(api_key=api_key)

# Load FAQ data
with open('static\\faq_data.json', 'r') as f:
    faq_data = json.load(f)

# Load or initialize user data
USER_DATA_FILE = 'user_data.json'
if os.path.exists(USER_DATA_FILE):
    with open(USER_DATA_FILE, 'r') as f:
        user_data = json.load(f)
else:
    user_data = {}

# Gemini model
model = genai.GenerativeModel(model_name='gemini-1.5-flash')

def save_user_data():
    with open(USER_DATA_FILE, 'w') as f:
        json.dump(user_data, f, indent=4)

@app.route('/')
def home():
    return render_template('index.html')

@app.route('/get', methods=['POST'])
def chatbot_response():
    data = request.json
    user_input = data['msg']
    user_id = data.get('user_id', str(uuid4()))
    user_type = data.get('user_type', 'Student')
    user_name = data.get('user_name', 'User')

    # Initialize user data if not exists
    if user_id not in user_data:
        user_data[user_id] = {
            'name': user_name,
            'type': user_type,
            'history': [],
            'whatsapp_count': 0,
            'feedback': []
        }

    # Update user name if provided and not default
    if user_name != 'User' and user_data[user_id]['name'] == 'User':
        user_data[user_id]['name'] = user_name

    # Update WhatsApp query count
    if 'whatsapp' in user_input.lower():
        user_data[user_id]['whatsapp_count'] = user_data[user_id].get('whatsapp_count', 0) + 1
    user_data[user_id]['history'].append(user_input)
    user_data[user_id]['history'] = user_data[user_id]['history'][-3:]  # Keep last 3
    save_user_data()

    # Check if user needs quick access tips
    quick_access = ''
    if user_data[user_id]['whatsapp_count'] >= 3:
        quick_access = '\n\nQuick Access WhatsApp Tips:\n' + '\n'.join(faq_data['Quick Access']['WhatsApp Tips'])

    # Convert FAQ dict to formatted string for context
    faq_prompt = ""
    for category, questions in faq_data[user_type].items():
        for question, steps in questions.items():
            faq_prompt += f"Q: {question}\nA: {' '.join(steps)}\n\n"

    # Create system prompt
    name_prefix = f"Hi {user_data[user_id]['name']}! " if user_data[user_id]['name'] != 'User' else ''
    final_prompt = (
        f"You're a friendly and helpful digital assistant for Indian {user_type.lower()}s. "
        "Use the following FAQ examples to help you answer user questions:\n\n"
        f"{faq_prompt}"
        "\nUser: " + user_input + "\nAssistant:"
    )

    try:
        response = model.generate_content(final_prompt)
        reply = response.text + quick_access
    except Exception as e:
        print(f"Error in generating content: {str(e)}")
        reply = name_prefix + f"Oops! There was an error: {str(e)}"

    return jsonify({
        'reply': reply,
        'user_id': user_id
    })

@app.route('/feedback', methods=['POST'])
def submit_feedback():
    data = request.json
    user_id = data['user_id']
    message = data['message']
    feedback = data['feedback']
    user_data[user_id]['feedback'].append({'message': message, 'feedback': feedback})
    save_user_data()
    return jsonify({'status': 'success'})

@app.errorhandler(404)
def page_not_found(e):
    return render_template('404.html'), 404

if __name__ == '__main__':
    app.run(debug=True)