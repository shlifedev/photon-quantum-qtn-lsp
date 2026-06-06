plugins {
    id("java")
    id("org.jetbrains.kotlin.jvm") version "1.9.25"
    id("org.jetbrains.intellij.platform") version "2.2.1"
}

group = "com.qtn"
version = providers.gradleProperty("pluginVersion").get()

repositories {
    mavenCentral()
    intellijPlatform {
        defaultRepositories()
    }
}

dependencies {
    intellijPlatform {
        rider(providers.gradleProperty("platformVersion").get())
        bundledPlugin("org.jetbrains.plugins.textmate")
        pluginVerifier()
    }
}

intellijPlatform {
    pluginConfiguration {
        id = "com.qtn.syntax-highlighting"
        name = "Quantum DSL (QTN) Syntax Highlighting"
        version = providers.gradleProperty("pluginVersion").get()
        ideaVersion {
            sinceBuild = providers.gradleProperty("pluginSinceBuild")
            untilBuild = providers.gradleProperty("pluginUntilBuild")
        }
    }
    signing {
        certificateChain = providers.environmentVariable("CERTIFICATE_CHAIN")
        privateKey = providers.environmentVariable("PRIVATE_KEY")
        password = providers.environmentVariable("PRIVATE_KEY_PASSWORD")
    }

    publishing {
        token = providers.environmentVariable("PUBLISH_TOKEN")
    }

    buildSearchableOptions = false
    instrumentCode = false
}

tasks {
    buildPlugin {
        archiveVersion.set("")
    }
    prepareSandbox {
        from("src/main/resources/bundles") {
            into("${intellijPlatform.projectName.get()}/bundles")
        }
        // Bundle the QTN Language Server (compiled JS + dependencies)
        from("../language-server/out") {
            into("${intellijPlatform.projectName.get()}/language-server/out")
        }
        from("../language-server/node_modules") {
            into("${intellijPlatform.projectName.get()}/language-server/node_modules")
        }
        from("../language-server/package.json") {
            into("${intellijPlatform.projectName.get()}/language-server")
        }
    }
}

kotlin {
    jvmToolchain(17)
}
