import java.util.Properties

plugins {
    id("com.android.application")
}

// La llave de SUBIDA vive FUERA del repositorio (C:\Android\firma), la misma de Budget y de KITS.
// Sin ella igual se compila la version de prueba (debug); la firmada no.
val archivoFirma = file(System.getenv("CURSO_FIRMA") ?: "C:/Android/firma/firma.properties")
val firma = Properties().apply { if (archivoFirma.exists()) archivoFirma.inputStream().use { load(it) } }

android {
    namespace = "org.fundacionsocialmentesbrillantes.curso"
    compileSdk = 37

    defaultConfig {
        // OJO: si algun dia va a Google Play, este nombre tecnico ya no se puede cambiar.
        applicationId = "org.fundacionsocialmentesbrillantes.curso"
        minSdk = 24
        targetSdk = 36
        // Subir versionCode en cada version nueva que se reparta (Android no instala una igual o mas vieja encima).
        versionCode = 1
        versionName = "1.0.0"
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    signingConfigs {
        if (archivoFirma.exists()) {
            create("subida") {
                storeFile = file(firma.getProperty("storeFile"))
                storePassword = firma.getProperty("storePassword")
                keyAlias = firma.getProperty("keyAlias")
                keyPassword = firma.getProperty("keyPassword")
            }
        }
    }

    buildTypes {
        release {
            // Quita el codigo que no se usa de las librerias (la app pesa menos).
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"))
            if (archivoFirma.exists()) signingConfig = signingConfigs.getByName("subida")
        }
    }
}

dependencies {
    // Abre la web del curso a pantalla completa en Chrome (Trusted Web Activity).
    implementation("com.google.androidbrowserhelper:androidbrowserhelper:2.7.4")
}
