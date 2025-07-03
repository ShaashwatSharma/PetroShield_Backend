
# 🚨 PetroShield

PetroShield is a comprehensive fleet fuel monitoring and theft detection platform. It helps organizations track vehicle fuel usage in real-time, detect theft or leakage, analyze patterns, and generate actionable insights — all in one place.

## ✨ Key Features

- 🚚 Real-time fuel level monitoring via sensors
- 🔒 Fuel theft and leakage detection (with ML-based anomaly detection)
- 🗺️ Vehicle tracking (GPS integration)
- 📊 Consumption analytics and reports
- ⚠️ Automated alerts and notifications
- 🧑‍💼 Role-based user management via Keycloak
- 🪄 Clean microservices architecture

---

## ⚙️ Tech Stack

- **TypeScript** (Node.js)
- **Express.js** for REST APIs
- **Prisma ORM** (PostgreSQL databases)
- **MQTT** for real-time sensor data ingestion
- **AWS** (EC2, RDS, S3, CloudFront)
- **Keycloak** for authentication & authorization
- **Docker + Docker Compose**
- **ML Model** for advanced anomaly detection

---

## 🗺️ Architecture Overview

```
Device → MQTT Broker (Mosquitto) → AWS IoT Core → Fuel & Theft Service → PostgreSQL
                                    ↘ SQS → Notification Service → Alerts
                                    ↘ Reporting Service → Reports & Analytics
                                    ↘ Vehicle Service → Vehicle DB
                                    ↘ User Management Service → Keycloak & Assignments
```

---

## 🚀 Services

| Service              | Port  | Description                               |
|----------------------|--------|-------------------------------------------|
| User Management      | 3001  | Handles users via Keycloak               |
| Vehicle Service      | 3002  | Manages vehicles                         |
| Notification Service | 3003  | Sends alerts and notifications          |
| Reporting Service    | 3004  | Generates reports and analytics         |
| Fuel & Theft Service | 3000  | Processes fuel logs, detects theft      |

---

## 🏁 Local Setup

### 1️⃣ Clone the repository

```bash
git clone https://github.com/yourusername/petroshield.git
cd petroshield
```

### 2️⃣ Install Docker & Docker Compose

Make sure you have [Docker](https://docs.docker.com/get-docker/) and [Docker Compose](https://docs.docker.com/compose/install/) installed.

### 3️⃣ Copy environment files

```bash
cp .env.example .env
```

Edit `.env` to set your database URLs, Keycloak details, and MQTT broker configurations.

---

### 4️⃣ Start Keycloak

If you haven't already:

```bash
docker run -d --name keycloak -p 8080:8080 -e KEYCLOAK_ADMIN=admin -e KEYCLOAK_ADMIN_PASSWORD=admin quay.io/keycloak/keycloak:latest start-dev
```

- Access Keycloak at: [http://localhost:8080](http://localhost:8080)
- Create a Realm (e.g., `myrealm`)
- Create a Client (e.g., `myclient`) with `confidential` access type, and note the **Client ID** and **Secret**
- Create roles and users as needed

---

### 5️⃣ Configure services

Update `.env` or service configs to include:

```
KEYCLOAK_BASE_URL=http://localhost:8080/realms/myrealm
KEYCLOAK_CLIENT_ID=myclient
KEYCLOAK_CLIENT_SECRET=your-secret
DATABASE_URL=postgresql://user:password@db:5432/dbname
MQTT_BROKER_URL=mqtt://broker:1883
```

---

### 6️⃣ Build & start services

```bash
docker-compose up --build
```

Services will start on ports:  
- 3000 → Fuel & Theft Service  
- 3001 → User Management Service  
- 3002 → Vehicle Service  
- 3003 → Notification Service  
- 3004 → Reporting Service

---

## 💬 API Overview

### Authenticated requests

All API routes are secured via Keycloak tokens. Include:

```
Authorization: Bearer <your-access-token>
```

---

## 🤖 ML-based anomaly detection

We use an integrated ML model to detect anomalies in fuel consumption and movement patterns. It helps to identify suspicious activities (like sudden drops or unplanned refills) and reduce false alarms.

---

## 🧪 Development commands

### Install dependencies

```bash
npm install
```

### Run individual services locally

```bash
# Example for User Management Service
cd user-management-service
npm run dev
```

---

## 🛡️ Security

- Role-based access using Keycloak
- Token validation via middleware
- Secure service-to-service communication
- Separate databases per service

---

## 💬 Contributing

Pull requests and feedback are welcome! Please open an issue first to discuss what you’d like to change.

---

## 🖖 Authors

- Shaashwat Sharma (https://github.com/shaashwatsharma)

---

