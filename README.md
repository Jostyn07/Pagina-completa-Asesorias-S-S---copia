# S&S ASESORÍAS - Sistema de Gestión de Pólizas

## 📋 Descripción
Plataforma web para la gestión de pólizas de seguros médicos desarrollada para S&S Asesorías. Sistema completo con autenticación, dashboard administrativo y gestión de pólizas.

## 🗂️ Estructura del Proyecto

```
proyecto/
├── index.html              # Página principal (redirige al login)
├── css/
│   ├── login.css          # Estilos de la página de login
│   ├── home.css           # Estilos de la página principal
│   └── polizas.css        # Estilos de la página de pólizas
├── js/
│   └── main.js            # JavaScript principal (autenticación, sidebar)
├── images/
│   ├── Logo.png           # Logo de S&S Asesorías
│   ├── Montañas.jpg       # Imagen de fondo 1
│   └── Montañas2.jpg      # Imagen de fondo 2 (login)
└── pages/
    ├── login.html         # Página de inicio de sesión
    ├── home.html          # Dashboard principal
    └── polizas.html       # Gestión de pólizas
```

## 🎨 Paleta de Colores

### Colores Principales
- **Azul Primario**: `#0066cc` - Botones principales, encabezados
- **Verde Salud**: `#00a76f` - Indicadores positivos, confirmaciones
- **Azul Oscuro**: `#003d7a` - Textos principales, títulos
- **Gris Claro**: `#f5f7fa` - Fondos, secciones alternadas
- **Blanco**: `#fff` - Tarjetas, modales
- **Naranja Acento**: `#ff9800` - Alertas, notificaciones urgentes

### Gradientes
- **Header**: `linear-gradient(to right, #0066cc, #00a76f)`

## ✨ Características Implementadas

### Fase 1: Organización y Estructura ✅
- ✅ Estructura de carpetas profesional
- ✅ Rutas de archivos corregidas
- ✅ Encoding UTF-8 correcto (caracteres especiales)
- ✅ Variables CSS para colores consistentes
- ✅ Sistema de archivos modular

### Sistema de Autenticación
- Login con validación de email
- Protección de rutas (páginas protegidas)
- Almacenamiento de sesión con localStorage
- Redirección automática

### Dashboard Principal (Home)
- Encabezado con saludo personalizado
- Fecha actual en tiempo real
- Tarjetas de resumen (Pólizas, Clientes, etc.)
- Actividad reciente
- Navegación responsive

### Gestión de Pólizas
- Sidebar colapsable con Material Icons
- Tarjetas de información (Activas, Canceladas, Próximas)
- Barra de búsqueda y filtros
- Tabla de pólizas con datos de ejemplo
- Diseño completamente responsive

## 🚀 Cómo Usar

### 1. Abrir el Proyecto
Simplemente abre `index.html` en tu navegador o configura un servidor local.

### 2. Login
- La página redirige automáticamente al login
- Usa cualquier correo válido para entrar (demo)
- Contraseña: cualquier valor

### 3. Navegación
- **Home**: Dashboard con estadísticas generales
- **Pólizas**: Gestión completa de pólizas de seguros
- **Gestiones**: (En desarrollo)
- **Seguimiento**: (En desarrollo)

## 📱 Responsive Design
El sistema está completamente optimizado para:
- 💻 Desktop (1024px+)
- 📱 Tablet (768px - 1024px)
- 📱 Mobile (< 768px)

## 🔧 Próximas Mejoras (Fases Siguientes)

### Fase 2: Funcionalidad de Login
- [ ] Integración con backend
- [ ] Autenticación real con API
- [ ] Recuperación de contraseña
- [ ] Validaciones avanzadas

### Fase 3: Dashboard Completo
- [ ] Gráficos estadísticos
- [ ] Widgets interactivos
- [ ] Exportación de reportes

### Fase 4: Gestión Avanzada de Pólizas
- [ ] CRUD completo de pólizas
- [ ] Sistema de archivos adjuntos
- [ ] Notificaciones de vencimiento
- [ ] Filtros avanzados

### Fase 5: Integraciones
- [ ] Conexión con Supabase/PostgreSQL
- [ ] API RESTful
- [ ] Sistema de permisos y roles
- [ ] Auditoría de cambios

## 🛠️ Tecnologías Utilizadas
- HTML5
- CSS3 (Variables CSS, Flexbox, Grid)
- JavaScript Vanilla (ES6+)
- Material Symbols (Google Icons)
- Google Fonts (Poppins, Inter, Open Sans)

## 📝 Notas Importantes
- Todas las rutas usan rutas relativas (`../`)
- El encoding es UTF-8 para soportar caracteres especiales
- El sistema usa localStorage para mantener sesiones
- Las páginas protegidas verifican autenticación automáticamente

## 👨‍💻 Desarrollo
Desarrollado por JOstyn para S&S Asesorías
Versión: 1.0.0 - Fase 1 Completada
Fecha: Diciembre 2025

## 📄 Licencia
Uso exclusivo para S&S Asesorías
