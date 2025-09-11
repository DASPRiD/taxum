# Changelog

## [0.15.1](https://github.com/DASPRiD/taxum/compare/core-v0.15.0...core-v0.15.1) (2025-09-11)


### Bug Fixes

* **core:** export header extractor from extract namespace ([31dc140](https://github.com/DASPRiD/taxum/commit/31dc140840fbc4b8de6203c6ca523bd6a1dd913e))

## [0.15.0](https://github.com/DASPRiD/taxum/compare/core-v0.14.0...core-v0.15.0) (2025-09-11)


### Features

* **core:** add header extractor ([57a3290](https://github.com/DASPRiD/taxum/commit/57a3290027966f64a74f005bc89bb3ce4a15b0d7))

## [0.14.0](https://github.com/DASPRiD/taxum/compare/core-v0.13.0...core-v0.14.0) (2025-08-25)


### Features

* **core:** add better debugging to HTTP components ([131fcfe](https://github.com/DASPRiD/taxum/commit/131fcfe33d01b8e7b003b2746218514ff1148a05))


### Bug Fixes

* **core:** make InsertHeaderMode constants read-only ([67f0fb2](https://github.com/DASPRiD/taxum/commit/67f0fb25e6b4fffd216538d77d6b7db6f556f50e))

## [0.13.0](https://github.com/DASPRiD/taxum/compare/core-v0.12.0...core-v0.13.0) (2025-08-23)


### Features

* **core:** add sensitive-headers middleware ([803f72f](https://github.com/DASPRiD/taxum/commit/803f72fa2ac019a78c43403836437f1cce7a1528))
* **core:** turn header values into a class with sensitive flag ([5e525ee](https://github.com/DASPRiD/taxum/commit/5e525eeb58d75d3e6a7b9995d60a1e1ed4eba7a4))

## [0.12.0](https://github.com/DASPRiD/taxum/compare/core-v0.11.0...core-v0.12.0) (2025-08-22)


### Features

* **core:** use Transform.toWeb() to apply Node.js transforms ([0c17867](https://github.com/DASPRiD/taxum/commit/0c1786702e8fb6faac6e6007287d5c8904b2526f))

## [0.11.0](https://github.com/DASPRiD/taxum/compare/core-v0.10.0...core-v0.11.0) (2025-08-22)


### Features

* **core:** allow creating HttpResponse from undici Response ([59f9b7e](https://github.com/DASPRiD/taxum/commit/59f9b7e297f71e3836d80b52ddd42f1bfefa587f))

## [0.10.0](https://github.com/DASPRiD/taxum/compare/core-v0.9.0...core-v0.10.0) (2025-08-22)


### Features

* exchange legacy Node.js stream with WHATWG streams ([52652eb](https://github.com/DASPRiD/taxum/commit/52652ebe8daab599085c347385978cf2a55c3966))
* exchange legacy Node.js stream with WHATWG streams ([5f7f5dd](https://github.com/DASPRiD/taxum/commit/5f7f5ddb43e408a8d887da904072c43b9cbfd526))

## [0.9.0](https://github.com/DASPRiD/taxum/compare/core-v0.8.0...core-v0.9.0) (2025-08-21)


### Features

* add set-header middleware ([9019a90](https://github.com/DASPRiD/taxum/commit/9019a902457c139319a98aaf4c3eb1f4ed628c29))

## [0.8.0](https://github.com/DASPRiD/taxum/compare/core-v0.7.0...core-v0.8.0) (2025-08-20)


### Features

* **core:** add withOptionLayer to ServiceBuilder ([34ca1cb](https://github.com/DASPRiD/taxum/commit/34ca1cb421f00425cb67918664edcf769bcfb392))

## [0.7.0](https://github.com/DASPRiD/taxum/compare/core-v0.6.0...core-v0.7.0) (2025-08-19)


### Features

* **core:** add trace middleware ([e71b974](https://github.com/DASPRiD/taxum/commit/e71b974abd866c617c88885e972d9d98c785bc92))
* **core:** rename globalLogger to loggerProxy ([8558aed](https://github.com/DASPRiD/taxum/commit/8558aedb2ab24d6f8eb21ab94320174e16b4986f))
* expand logging proxy ([9b99e4d](https://github.com/DASPRiD/taxum/commit/9b99e4d5dcef0326ad29a79d326a8bce882d097a))
* return every error as a ClientError ([2e946de](https://github.com/DASPRiD/taxum/commit/2e946de61c2be6cb8bd29e50615d3ca807cb2411))


### Bug Fixes

* **fs:** update logger usage ([7170079](https://github.com/DASPRiD/taxum/commit/717007968ad1a9f2cfeb5d5201f749ee6f029e0c))

## [0.6.0](https://github.com/DASPRiD/taxum/compare/core-v0.5.0...core-v0.6.0) (2025-08-18)


### Features

* large rewrite of the middleware system ([1e1b4d7](https://github.com/DASPRiD/taxum/commit/1e1b4d73b8982ff6d0c55375662eac0fb94a1bfe))

## [0.5.0](https://github.com/DASPRiD/taxum/compare/core-v0.4.0...core-v0.5.0) (2025-08-14)


### Features

* add cookie package ([#17](https://github.com/DASPRiD/taxum/issues/17)) ([5a16b1d](https://github.com/DASPRiD/taxum/commit/5a16b1d3a21d60fd000c8f00c6b7d258606e85c6))

## [0.4.0](https://github.com/DASPRiD/taxum/compare/core-v0.3.0...core-v0.4.0) (2025-08-14)


### Features

* add ToHttpResponseParts and update ToHttpResponse to use unique symbols ([467d4c6](https://github.com/DASPRiD/taxum/commit/467d4c672c09b7fe39103ad6835ef44cb4a0638a))

## [0.3.0](https://github.com/DASPRiD/taxum/compare/core-v0.2.0...core-v0.3.0) (2025-08-13)


### Features

* **core:** add serviceLayerFn helper ([ea55dbd](https://github.com/DASPRiD/taxum/commit/ea55dbd2793331b943027ef052b2f36e7186e932))


### Bug Fixes

* **core:** update Layer usage typings ([4668613](https://github.com/DASPRiD/taxum/commit/4668613576413f1847c936d682f8ad3007433c44))

## [0.2.0](https://github.com/DASPRiD/taxum/compare/core-v0.1.1...core-v0.2.0) (2025-08-12)


### Features

* **core:** rename handler() to extractHandler() and support positional argument extractors ([978ab6a](https://github.com/DASPRiD/taxum/commit/978ab6a209b2207e045050d0f7b2c6db34307c54))

## [0.1.1](https://github.com/DASPRiD/taxum/compare/core-v0.1.0...core-v0.1.1) (2025-08-11)


### Bug Fixes

* **core:** apply defaults to FnLayer templates ([843ca70](https://github.com/DASPRiD/taxum/commit/843ca7017541843cbaae216b365ccdb485696395))

## [0.1.0](https://github.com/DASPRiD/taxum/compare/core-v0.0.1...core-v0.1.0) (2025-08-11)


### Features

* add error handling and finalize layer tests ([72ac202](https://github.com/DASPRiD/taxum/commit/72ac202f245e83341e709c5f02e1d71c87bbdf7d))
* add fs package ([15230fa](https://github.com/DASPRiD/taxum/commit/15230fadcad656e192f26f0b272e0d646493181a))
* **core:** add single path param extractor ([6e3addf](https://github.com/DASPRiD/taxum/commit/6e3addf360427eb8ec1e73f1071ac8130836f5c0))
* initial commit ([1c912ad](https://github.com/DASPRiD/taxum/commit/1c912ad75113592b6fddc18c93d92916468ceff0))
* minor tweaks and additional documentation ([5464ca7](https://github.com/DASPRiD/taxum/commit/5464ca749176da18c5f2fa6d430e68ee1ecd1371))
* **routing:** rewrite service architecture ([e79f7e9](https://github.com/DASPRiD/taxum/commit/e79f7e97caa36d091c3dfa369da80a9f918c4be4))
