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
            // 상한 없음: since-build 이후 모든 IDE(미래 버전 포함) 호환.
            // 빈 until-build("")는 마켓 검증에서 거부되므로 provider { null }로 속성을 생략한다.
            untilBuild = provider { null }
        }
    }
    signing {
        // 인증서/키는 CI에서 파일로 디코드해 경로만 주입한다.
        // (멀티라인 PEM을 -cert CLI 인자로 넘기면 전달 중 손상돼 "signed fields invalid"가 난다)
        certificateChainFile = layout.projectDirectory.file(providers.environmentVariable("CERTIFICATE_CHAIN_FILE"))
        privateKeyFile = layout.projectDirectory.file(providers.environmentVariable("PRIVATE_KEY_FILE"))
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
