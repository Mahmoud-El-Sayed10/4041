
from flask import Flask
from flask_cors import CORS


def create_app():
    app = Flask(__name__)

    CORS(
        app,
        resources={
            r"/api/*": {
                "origins": ["http://localhost:5173"]
            }
        }
    )

    @app.get("/api/health")
    def health():
        return {
            "status": "ok",
            "service": "4041-backend"
        }, 200

    return app
