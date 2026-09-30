#!/bin/bash
# Nginx reverse proxy configuration template
# This is an OPTIONAL reverse proxy setup
# The application also works perfectly well without it (proxyless mode)

echo "🛡️ Optional Nginx Reverse Proxy Configuration"
echo ""
echo "If you want to use Nginx as a reverse proxy (optional), create:"
echo "/etc/nginx/sites-available/vanity-sniper"
echo ""
echo "With this content:"
echo ""

cat << 'EOF'
upstream vanity_sniper {
    server localhost:3001;
    keepalive 64;
}

server {
    listen 80;
    server_name your-domain.com;

    # Optional: Redirect to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;

    # SSL certificates (optional)
    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;

    # Performance
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    # Proxy settings
    location / {
        proxy_pass http://vanity_sniper;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Health check endpoint
    location /health {
        proxy_pass http://vanity_sniper;
        access_log off;
    }
}
EOF

echo ""
echo "✅ Configuration shown above"
echo ""
echo "📄 To enable:"
echo "  1. Save to: /etc/nginx/sites-available/vanity-sniper"
echo "  2. Create symlink: ln -s /etc/nginx/sites-available/vanity-sniper /etc/nginx/sites-enabled/"
echo "  3. Test: sudo nginx -t"
echo "  4. Reload: sudo systemctl reload nginx"
echo ""
echo "📑 NOTE: This is OPTIONAL. The application works perfectly fine WITHOUT Nginx."
echo ""
