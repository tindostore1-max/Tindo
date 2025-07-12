
import os
import requests
from flask import session, redirect, request, url_for
from urllib.parse import urlencode
import secrets
import json

class GoogleAuth:
    def __init__(self, app=None):
        self.app = app
        self.client_id = None
        self.client_secret = None
        self.redirect_uri = None
        
        if app is not None:
            self.init_app(app)
    
    def init_app(self, app):
        """Inicializar la aplicación Flask con Google Auth"""
        self.app = app
        
        # Configuración desde variables de entorno
        self.client_id = os.getenv('GOOGLE_CLIENT_ID')
        self.client_secret = os.getenv('GOOGLE_CLIENT_SECRET')
        self.redirect_uri = os.getenv('GOOGLE_REDIRECT_URI', 'https://python-12-1yorbi1.replit.dev/oauth2callback')
        
        # Verificar que las credenciales estén configuradas
        if not self.client_id or not self.client_secret:
            print("⚠️ ADVERTENCIA: Google OAuth no está configurado correctamente.")
            print("   Asegúrate de configurar GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET en tus secrets.")
    
    def get_authorization_url(self):
        """Generar URL de autorización de Google"""
        if not self.client_id:
            return None
            
        # Generar estado aleatorio para seguridad
        state = secrets.token_urlsafe(32)
        session['oauth_state'] = state
        
        params = {
            'client_id': self.client_id,
            'redirect_uri': self.redirect_uri,
            'scope': 'openid email profile',
            'response_type': 'code',
            'state': state,
            'access_type': 'offline',
            'prompt': 'consent'
        }
        
        auth_url = 'https://accounts.google.com/o/oauth2/v2/auth?' + urlencode(params)
        return auth_url
    
    def handle_callback(self, code, state):
        """Manejar el callback de Google OAuth"""
        if not self.client_id or not self.client_secret:
            return None, "Google OAuth no está configurado"
        
        # Verificar estado para prevenir ataques CSRF
        if state != session.get('oauth_state'):
            return None, "Estado inválido"
        
        # Intercambiar código por token de acceso
        token_data = {
            'client_id': self.client_id,
            'client_secret': self.client_secret,
            'code': code,
            'grant_type': 'authorization_code',
            'redirect_uri': self.redirect_uri
        }
        
        try:
            # Obtener token de acceso
            token_response = requests.post(
                'https://oauth2.googleapis.com/token',
                data=token_data,
                headers={'Content-Type': 'application/x-www-form-urlencoded'}
            )
            
            if token_response.status_code != 200:
                return None, f"Error al obtener token: {token_response.text}"
            
            token_info = token_response.json()
            access_token = token_info.get('access_token')
            
            if not access_token:
                return None, "No se pudo obtener el token de acceso"
            
            # Obtener información del usuario
            user_info = self.get_user_info(access_token)
            if not user_info:
                return None, "No se pudo obtener información del usuario"
            
            return user_info, None
            
        except Exception as e:
            return None, f"Error en la autenticación: {str(e)}"
    
    def get_user_info(self, access_token):
        """Obtener información del usuario usando el token de acceso"""
        try:
            response = requests.get(
                "https://www.googleapis.com/oauth2/v3/userinfo",
                headers={"Authorization": f"Bearer {access_token}"}
            )
            
            if response.status_code == 200:
                return response.json()
            else:
                print(f"Error al obtener info del usuario: {response.status_code} {response.text}")
                return None
                
        except Exception as e:
            print(f"Excepción al obtener info del usuario: {str(e)}")
            return None
    
    def is_configured(self):
        """Verificar si Google OAuth está configurado correctamente"""
        return bool(self.client_id and self.client_secret)
