from flask import Flask, render_template, request, jsonify
from google.genai import types
from google import genai
import os
from dotenv import load_dotenv
import base64
import logging

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

load_dotenv()
API_KEY = os.getenv("GOOGLE_API_KEY")

if not API_KEY:
    logging.error("GOOGLE_API_KEY not found in environment variables.")
    # In a production app, you might want to exit or raise an error here.
    # For this example, we'll proceed, but API calls will fail.

app = Flask(__name__)

# Initialize Gemini Client globally or as needed
try:
    # genai.configure(api_key=API_KEY)
    client = genai.Client()
    # model = client.models.get('gemini-2.5-flash') # Get model once
    logging.info("Gemini API client initialized successfully.")
except Exception as e:
    logging.error(f"Error initializing Gemini API client: {e}")
    client = None # Set client to None if initialization fails


@app.route('/')
def index():
    return render_template('index.html')

@app.route('/solve_equation', methods=['POST'])
def solve_equation():
    if client is None:
        return jsonify({"error": "Gemini API client not initialized. Please check your API key."}), 500

    if 'image' not in request.files:
        logging.warning("No image part in the request.")
        return jsonify({"error": "No image part in the request."}), 400

    file = request.files['image']
    if file.filename == '':
        logging.warning("No selected file.")
        return jsonify({"error": "No selected file."}), 400
    file.save('query.png')
    if file:
        try:
            with open('query.png', 'rb') as f:
                image_bytes = f.read()
            # image_bytes = file.read()
            
            # Basic validation for image type
            # In a real app, you might want more robust validation
            # mime_type = "image/png" # Assuming the canvas will send PNG. Adjust if needed.

            logging.info("Sending image to Gemini API for solution.")
            response = client.models.generate_content(
                model='gemini-2.5-flash',
                contents=[
                    types.Part.from_bytes(
                        data=image_bytes,
                        mime_type="image/png",
                    ),
                    'can you please solve this'
                ]
            )
            logging.info("Received response from Gemini API.")
            return jsonify({"solution": response.text})

       
        except Exception as e:
            logging.error(f"An unexpected error occurred: {e}", exc_info=True)
            return jsonify({"error": f"An unexpected error occurred: {e}"}), 500
    
    return jsonify({"error": "Unknown error processing image."}), 500


if __name__ == '__main__':
    # Using host='0.0.0.0' to make it accessible from other devices on the network
    # For production, consider using a WSGI server like Gunicorn or uWSGI
    app.run(host='0.0.0.0', port=8000, debug=True) # debug=True for development, set to False in production
