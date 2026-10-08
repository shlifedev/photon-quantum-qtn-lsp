import org.jetbrains.intellij.platform.gradle.IntelliJPlatformType

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
    testImplementation("junit:junit:4.13.2")
    intellijPlatform {
        rider(providers.gradleProperty("platformVersion").get())
        bundledPlugin("org.jetbrains.plugins.textmate")
        pluginVerifier()
    }
}

intellijPlatform {
    pluginConfiguration {
        id = "com.qtn.syntax-highlighting"
        name = "Quantum DSL (QTN) Language Support"
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

    pluginVerification {
        ides {
            ide(IntelliJPlatformType.Rider, providers.gradleProperty("platformVersion").get())
        }
    }

    buildSearchableOptions = false
    instrumentCode = false
}

java {
    toolchain {
        languageVersion = JavaLanguageVersion.of(21)
    }
    sourceCompatibility = JavaVersion.VERSION_21
    targetCompatibility = JavaVersion.VERSION_21
}

val bundledRuntimeRoot = layout.projectDirectory.dir("../../dist/node-runtimes")
val verifyBundledRuntimes by tasks.registering(Exec::class) {
    commandLine("node", "../../scripts/prepare-node-runtime.mjs", "--target=jetbrains", "--check")
}

tasks {
    buildPlugin {
        archiveVersion.set("")
        eachFile {
            if (path.contains("/runtimes/") && name == "node") permissions { unix("rwxr-xr-x") }
        }
        doLast {
            check(archiveFile.get().asFile.length() < 400_000_000L) {
                "Rider plugin exceeds the Marketplace 400 MB limit"
            }
        }
    }
    prepareSandbox {
        dependsOn(verifyBundledRuntimes)
        doFirst {
            // webpack 번들은 의존성까지 한 파일에 들어 있어 node_modules를 동봉할 필요가 없다.
            check(file("../language-server/dist/server.js").exists()) {
                "language-server bundle not found — run 'npm run bundle:server' at repo root first"
            }
        }
        from("src/main/resources/bundles") {
            into("${intellijPlatform.projectName.get()}/bundles")
        }
        // 단일 webpack 번들 (QtnLspServerSupportProvider가 기대하는 out/ 경로 유지)
        from("../language-server/dist") {
            into("${intellijPlatform.projectName.get()}/language-server/out")
        }
        from(bundledRuntimeRoot) {
            into("${intellijPlatform.projectName.get()}/runtimes")
            include("*/node", "*/node.exe", "*/LICENSE", "*/runtime.json")
            eachFile {
                if (name == "node") permissions { unix("rwxr-xr-x") }
            }
        }
    }
}

kotlin {
    jvmToolchain(21)
}
