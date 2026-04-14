# **Business Case: QuickFixU**

## **1\. Resumen Ejecutivo**

**QuickFixU** es una aplicación móvil diseñada para conectar clientes con profesionales independientes, inicialmente enfocada en plomeros, gasistas y electricistas, con la posibilidad de expandirse a otras profesiones en futuras versiones. La app estará disponible en iOS y Android, con una landing page informativa en el lanzamiento y una versión web en desarrollo futuro.

El objetivo de QuickFixU es ofrecer una plataforma confiable, rápida y eficiente para la contratación de servicios a domicilio, mejorando la experiencia de los usuarios con funcionalidades como chat en tiempo real, publicación de problemas, pagos seguros y un sistema de reputación mutua.

La monetización se basará en comisiones por transacción, con una promoción inicial de 0% de comisión para profesionales que registren su tarjeta de crédito durante el primer año. Se espera alcanzar 5,000 profesionales y 10,000 clientes en el primer año de operación en Argentina, con planes de expansión a países vecinos.

---

## **2\. Contexto y Problema**

### **2.1 Problema Identificado**

* Dificultad para encontrar profesionales calificados y confiables en situaciones de emergencia.  
* Falta de un sistema que permita comparar presupuestos y leer reseñas antes de contratar.  
* Procesos de pago inseguros o con poca garantía para el cliente.  
* Desconfianza en plataformas existentes debido a la falta de validación de profesionales.

### **2.2 Oportunidad de Mercado**

* Crecimiento del uso de aplicaciones móviles para servicios a domicilio en Latinoamérica.  
* Alta demanda de servicios de plomería, gas y electricidad en hogares y empresas.  
* Necesidad de un sistema de pago seguro que proteja tanto a clientes como a profesionales.  
* Escasa competencia con una propuesta de valor diferenciada en Argentina.

---

## **3\. Propuesta de Solución**

### **3.1 Funcionalidades Clave**

* **Búsqueda y filtrado de profesionales** por cercanía y precio por hora.  
* **Chat en tiempo real** con opción de compartir imágenes y videos.  
* **Publicación de problemas** donde los profesionales pueden ofrecer presupuestos.  
* **Pagos a través de MercadoPago**, reteniendo fondos hasta que ambas partes confirmen la finalización del trabajo.  
* **Sistema de reputación bidireccional**, donde clientes y profesionales se califican mutuamente.  
* **Verificación de profesionales** mediante validación de documentos.  
* **Gestión de horarios**, permitiendo a los profesionales definir disponibilidad.

---

## **4\. Tipos de Usuarios y Roles**

### **4.1 Cliente**

* Busca y filtra profesionales.  
* Publica problemas y recibe presupuestos.  
* Chatea con profesionales y comparte imágenes/videos.  
* Realiza pagos y califica servicios.

### **4.2 Profesional**

* Configura su perfil con certificaciones y tarifas.  
* Filtra publicaciones de clientes y envía presupuestos.  
* Recibe pagos y califica a clientes.  
* Configura su disponibilidad horaria.

### **4.3 Administrador (Fase 2\)**

* Media en disputas entre clientes y profesionales.  
* Supervisa transacciones y calidad del servicio.  
* Gestiona reportes y soporte al usuario.

---

## **5\. Modelo de Negocio**

### **5.1 Monetización**

* **Comisión por transacción**: 0% el primer año si el profesional registra tarjeta de crédito (50% si no la registra). Luego, comisión fija del 10%.  
* **Planes de suscripción premium** para destacar profesionales en la plataforma.  
* **Bonos de fidelización**: Opcionalmente, un 25% de reembolso sobre 20 trabajos completados.

### **5.2 Políticas de Pago**

* El pago se retiene hasta la confirmación del servicio por ambas partes.  
* Penalización del 15% si el profesional cancela una visita sin motivo.  
* Penalización del 15% para clientes si cancelan después del pago (este monto va al profesional).

---

## **6\. Estrategia de Crecimiento y Marketing**

### **6.1 Adquisición de Usuarios**

* Campañas de publicidad en redes sociales.  
* Creación de comunidad en redes con contenido educativo y testimonios.  
* Incentivos de referidos para atraer clientes y profesionales.

### **6.2 Retención y Fidelización**

* Sistema de bonificaciones por cantidad de trabajos completados.  
* Mejora de visibilidad en la app para profesionales con calificaciones altas.  
* Programa de soporte y resolución de disputas eficiente.

---

## **7\. Análisis de Competencia**

**Competidores principales:** TaskRabbit, Habitissimo, Zolvers.

**Diferenciadores de QuickFixU:**

* Seguridad en pagos con retención hasta confirmación.  
* Feed de publicaciones de problemas, permitiendo comparar presupuestos.  
* Reputación mutua (profesionales califican clientes y viceversa).  
* Incentivos claros para profesionales y clientes.

---

## **8\. Riesgos y Estrategias de Mitigación**

### **8.1 Riesgos Tecnológicos**

* **Escalabilidad**: Implementación de servidores en la nube con capacidad de expansión.  
* **Seguridad de datos**: Uso de encriptación y autenticación multifactor para proteger información sensible.

### **8.2 Riesgos Legales**

* **Cumplimiento normativo**: Adaptación a regulaciones de comercio electrónico y protección de datos.  
* **Disputas legales**: Implementación de términos y condiciones claros, y mediación de conflictos.

### **8.3 Riesgos de Adopción**

* **Negociaciones fuera de la app**: Restricción de intercambio de datos de contacto antes del pago.  
* **Falta de oferta inicial de profesionales**: Campañas de captación y bonificaciones por inscripción temprana.

---

## **9\. Verificación de Profesionales**

La validación de documentos de los profesionales será un proceso automatizado utilizando tecnología **OCR (Reconocimiento Óptico de Caracteres)**. Este sistema permitirá extraer información clave de documentos como identificaciones, certificaciones y antecedentes profesionales, reduciendo el trabajo manual y agilizando el proceso de aprobación.

### **Opciones de Implementación:**

1. **Amazon Textract**: Un servicio de AWS que permite extraer datos estructurados de documentos con alta precisión.

2. **Tesseract.js**: Una librería de código abierto para OCR en JavaScript, útil para una solución más flexible sin depender de terceros.

La implementación de OCR en esta fase inicial permitirá validar los documentos de manera más rápida y segura, minimizando errores humanos y asegurando que solo profesionales verificados puedan ofrecer sus servicios en la plataforma.

---

## **10\. Chat en Tiempo Real**

El sistema de mensajería será implementado utilizando **WebSockets**, permitiendo una comunicación en tiempo real entre clientes y profesionales.

### **Beneficios de WebSockets:**

* Comunicación bidireccional sin necesidad de múltiples peticiones al servidor.

* Menor latencia en la entrega de mensajes.

* Mayor eficiencia en el uso de recursos del servidor.

Este chat será una pieza clave para facilitar la comunicación dentro de la plataforma y garantizar que ambas partes puedan coordinar detalles del servicio de manera eficiente.

---

## **11\. Restricción de Contacto Antes del Pago *(Segunda Versión)***

En futuras versiones, se implementará un mecanismo para restringir el intercambio de datos personales antes de que se concrete el pago del servicio. Esto evitará que los usuarios intenten realizar transacciones fuera de la plataforma, asegurando la seguridad y el cumplimiento de las políticas de QuickFixU.

Algunas estrategias a considerar para esta restricción incluyen:

* **Filtro de palabras clave**: Detección de información de contacto como números de teléfono o correos electrónicos dentro del chat.

* **Ofuscación de datos sensibles**: Remplazo automático de ciertos patrones de datos para evitar que los usuarios compartan información antes de completar el pago.

---

## **12\. Mediación de Disputas**

El rol del administrador será clave en la resolución de disputas entre clientes y profesionales. Dado que el sistema no contará con una resolución automática en la versión inicial, las disputas se gestionarán manualmente a través de un panel de administración, donde los administradores podrán:

* Revisar la evidencia proporcionada por ambas partes.

* Contactar a los involucrados para mediar en la situación.

* Aplicar sanciones o reembolsos según corresponda.

Este proceso garantizará una resolución justa de los conflictos y aumentará la confianza de los usuarios en la plataforma.

---

## **13\. Sistema de Reputación**

El sistema de reputación permitirá que tanto clientes como profesionales se califiquen mutuamente al finalizar un servicio.

### **Características Iniciales:**

* **Calificación y Reseña**: Ambas partes podrán dejar una calificación y un comentario basado en su experiencia.

* **Transparencia**: Las reseñas serán públicas en los perfiles de los usuarios para generar confianza en la comunidad.

### **Mejoras Futuras (Segunda Versión):**

* **Sistema de apelaciones**: En caso de recibir una calificación negativa, los profesionales podrán abrir un caso de revisión. Si logran solucionar el problema con el cliente, podrán solicitar la eliminación o modificación de la reseña negativa.

---

## **14\. Roadmap y Lanzamiento**

### **Fase 1 (0-6 meses): Desarrollo del MVP**

* Desarrollo de la app para iOS y Android.  
* Integración de MercadoPago y Google Analytics.  
* Creación de landing page informativa.

### **Fase 2 (6-12 meses): Expansión y Mejora**

* Implementación del rol de Administrador.  
* Expansión a otros países de Latinoamérica.  
* Integración de videollamadas y mensajes de voz en chat.

### **Fase 3 (12-24 meses): Diversificación**

* Implementación de suscripciones premium.  
* Expansión a nuevos mercados (EE.UU. y Europa).  
* Creación de una versión web para gestionar servicios.

---

## **15\. Conclusión**

**QuickFixU** se posiciona como la solución ideal para conectar clientes con profesionales de manera segura y eficiente. Con un enfoque en la confianza, la rapidez y la calidad del servicio, la plataforma tiene el potencial de convertirse en el referente del sector en Latinoamérica.

La combinación de una estructura de comisiones innovadora, garantías para clientes y profesionales, y una interfaz intuitiva, aseguran un alto nivel de adopción y retención de usuarios.

Los próximos pasos incluyen el desarrollo del MVP y las estrategias de marketing para su lanzamiento en Argentina.

---

## **16\. Flujo como Cliente:**

Al ingresar a la app, el usuario verá tres opciones principales en la pantalla de inicio: **Crear publicación, Buscar profesionales, Mi perfil y Mensajes**.

1. **Crear publicación:**

   * Sección para detallar un problema o servicio requerido.  
   * Campos obligatorios: **Título, Descripción, Tags (obligatorio)** para especificar si se necesita un electricista, gasista o plomero.  
   * Opción de cargar imágenes o videos para mayor claridad.  
   * Historial de publicaciones con un sistema de autolimpieza después de cierto tiempo, permitiendo llevar un registro de problemas recurrentes.  
2. **Buscar profesionales:**

   * Listado de profesionales cercanos basado en la dirección del usuario.  
   * Filtros por tipo de profesional y ordenamiento por tarifa.  
   * Al seleccionar un profesional, se accede a su perfil con detalles como:  
     * Reseñas y calificaciones.  
     * Tarifas y servicios ofrecidos.  
     * Opción de enviar un mensaje directo para negociar.  
   * Una vez acordado un presupuesto (válido por 48 horas), el usuario puede **aceptarlo o rechazarlo**.  
   * Métodos de pago: **Tarjeta, Mercado Pago o efectivo**.  
3. **Mensajes:**

   * Historial de conversaciones con profesionales.  
   * Opción de compartir imágenes y videos para clarificar problemas.  
4. **Perfil del usuario:**

   * Visualización de calificación y reseñas recibidas.  
   * Edición de datos personales: **Nombre completo, Dirección, DNI**.

---

## **17\. Flujo como Profesional:**

Al ingresar a la app, el profesional tendrá acceso a un **feed de trabajos publicados por clientes**, donde se muestran problemas a solucionar, como arreglar una fuga de agua o instalar un tomacorriente.

1. **Interacción con publicaciones:**

   * Al acceder a una publicación, el profesional puede:  
     * **Ver el perfil del cliente**, incluyendo calificaciones y reseñas de otros profesionales.  
     * **Ofrecer un presupuesto**, que se enviará al cliente mediante mensaje directo.  
   * Una vez que el cliente acepta el presupuesto, realiza el pago, y el profesional recibirá el dinero al completar el trabajo.  
   * **Pagos en efectivo:** Si el cliente paga en efectivo, se generará una “deuda” que será descontada automáticamente de la tarjeta del profesional al final del mes (aplicable tras el primer año, cuando la comisión sea del 10%).  
2. **Navegación en la Home:**

   * **Feed:** Publicaciones de clientes en tiempo real.  
   * **Mensajes:** Conversaciones activas con clientes.  
   * **Calendario:** Vista en **timeline** con próximas citas o trabajos agendados.  
   * **Perfil:** Sección para editar datos personales, disponibilidad horaria, tarifas y certificados.  
3. **Creación de Presupuesto:**

   * Formulario con los siguientes campos:  
     * **Título** (Ej: "Reparación de fuga de agua").  
     * **Descripción** detallada del trabajo.  
     * **Fecha y hora** estimada del servicio.  
     * **Monto total**.  
4. **Perfil del Profesional:**

   * Datos editables:  
     * Foto de perfil.  
     * Nombre y apellido.  
     * Empresa o compañía (opcional).  
     * DNI y dirección.  
     * Tarjeta de crédito.  
     * Certificaciones y matrículas.  
     * Categorías o especialidades (plomería, gasista, electricista, etc.).  
   * Métricas visibles:  
     * **Calificación y reseñas** de clientes.  
     * Cantidad de trabajos completados en el mes.  
     * Progreso hacia el **bono de fidelización**.

Puntos importantes a tener en cuenta:

* Chat en tiempo real [🔥CREAR \#CHAT EN \#TIEMPO \#REAL CON \#ReactJS y \#NodeJS | Tutorial de \#Socket  - 2024 - ESPAÑOL](https://www.youtube.com/watch?v=_-cKHduVAcQ)

* Historial de los chats  
* Historial de post  
* Almacenamiento de imagenes y videos (mucha cantidad, complejidad con AWS S3 o Firebase Storage)  
* Almacenamiento de pdfs para los certificados y matriculas  
* Integracion con google maps o similar  
* Pasarela de pago (con MP o Stripe)  
* Un cronjob que se ejecute cuando hayan pasado 48hs de la publicacion del post

