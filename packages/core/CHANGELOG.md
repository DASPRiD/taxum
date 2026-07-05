# Changelog

## [1.3.0](https://github.com/DASPRiD/taxum/compare/core-v1.2.4...core-v1.3.0) (2026-07-05)


### Features

* **core:** add Server-Sent Events (SSE) support ([#50](https://github.com/DASPRiD/taxum/issues/50)) ([9a5c716](https://github.com/DASPRiD/taxum/commit/9a5c716da3ab8a4d624ceaabd036cb393683c5f2))
* **core:** add spoofing-resistant trusted-hop client IP extraction ([#75](https://github.com/DASPRiD/taxum/issues/75)) ([b2106d6](https://github.com/DASPRiD/taxum/commit/b2106d630213a839aba04da226de47bd5b4347a7))
* **core:** expose disconnect and shutdown signals to request handlers ([#58](https://github.com/DASPRiD/taxum/issues/58)) ([748e992](https://github.com/DASPRiD/taxum/commit/748e99214d9abc922c28c726603618c0ed19276a))
* **core:** store connect info as request extension ([#59](https://github.com/DASPRiD/taxum/issues/59)) ([6a63776](https://github.com/DASPRiD/taxum/commit/6a63776540e28f7c72b7b4beb142756701f90ece))


### Bug Fixes

* **core:** arm the SSE keep-alive timer lazily on first read ([#73](https://github.com/DASPRiD/taxum/issues/73)) ([b188a79](https://github.com/DASPRiD/taxum/commit/b188a79d205ce26556d58067a50c5424915d2481))
* **core:** bump nested-search-params to 1.0.2 ([#82](https://github.com/DASPRiD/taxum/issues/82)) ([5c178e8](https://github.com/DASPRiD/taxum/commit/5c178e895271b468539f16d54de96e0769ae47bc))
* **core:** cancel a discarded leading response body in HttpResponse.from ([#72](https://github.com/DASPRiD/taxum/issues/72)) ([6d22221](https://github.com/DASPRiD/taxum/commit/6d22221dde39268c9f54092f6a586c0401b5b150))
* **core:** cancel discarded response bodies for HEAD and CONNECT ([#60](https://github.com/DASPRiD/taxum/issues/60)) ([77e56b7](https://github.com/DASPRiD/taxum/commit/77e56b7284d7553f03cf2c2648ffc74a27bdc0ca))
* **core:** close connections properly during graceful shutdown ([#55](https://github.com/DASPRiD/taxum/issues/55)) ([7150ff5](https://github.com/DASPRiD/taxum/commit/7150ff5651b7e6cc2764034bc151ef7075814014))
* **core:** correct body-limit boundary and always vary on compression candidates ([#68](https://github.com/DASPRiD/taxum/issues/68)) ([02bf2d3](https://github.com/DASPRiD/taxum/commit/02bf2d3061328eb52359b81a236a1599a10b95e7))
* **core:** correct framing for bodyless and empty-body responses ([#79](https://github.com/DASPRiD/taxum/issues/79)) ([8743419](https://github.com/DASPRiD/taxum/commit/8743419cba4c751c62a818c309147e95af5e3651))
* **core:** keep route maps consistent on conflict and set Content-Length on fallback HEAD ([#69](https://github.com/DASPRiD/taxum/issues/69)) ([6d2073c](https://github.com/DASPRiD/taxum/commit/6d2073c6fa070f8a84eca180778bd2bc517b221c))
* **core:** match a literal dot in the q-value pattern ([#78](https://github.com/DASPRiD/taxum/issues/78)) ([ea68d0b](https://github.com/DASPRiD/taxum/commit/ea68d0b3db4c975d750a5a5f273b3a138c7babfe))
* **core:** preserve connectInfo when middleware rebuilds requests ([#57](https://github.com/DASPRiD/taxum/issues/57)) ([61660f2](https://github.com/DASPRiD/taxum/commit/61660f221d76fe3666750afcbe00a840ffd8854f))
* **core:** preserve multiple values per key in HeaderMap.extend ([#63](https://github.com/DASPRiD/taxum/issues/63)) ([03ba5a6](https://github.com/DASPRiD/taxum/commit/03ba5a6bdeb5f7bf3b91017830a51c7ff14f958a))
* **core:** prevent a __proto__ header from reparenting serialized output ([#77](https://github.com/DASPRiD/taxum/issues/77)) ([20fc5ab](https://github.com/DASPRiD/taxum/commit/20fc5aba726c4a4626f917235a1eb55cbf9eeb4e))
* **core:** reject wildcard CORS rules with a credentials predicate ([#65](https://github.com/DASPRiD/taxum/issues/65)) ([3955814](https://github.com/DASPRiD/taxum/commit/395581432547c893829ec39fc267859b88dddcfb))
* **core:** scope signal handlers and clean up listeners on serve() failure ([#70](https://github.com/DASPRiD/taxum/issues/70)) ([b75158d](https://github.com/DASPRiD/taxum/commit/b75158dc2e591e1081ca6e75016fcc75430e185a))
* **core:** tolerate content-type parameters and malformed content-type in extractors ([#67](https://github.com/DASPRiD/taxum/issues/67)) ([5617591](https://github.com/DASPRiD/taxum/commit/561759172f49d1de3cb4302f86d7d03996cad397))

## [1.2.4](https://github.com/DASPRiD/taxum/compare/core-v1.2.3...core-v1.2.4) (2026-05-06)


### Bug Fixes

* **core:** swallow more client-abort errors in HttpResponse.write ([08c0369](https://github.com/DASPRiD/taxum/commit/08c03697827e40078ce5afb051b9c22ed6c81db8))

## [1.2.3](https://github.com/DASPRiD/taxum/compare/core-v1.2.2...core-v1.2.3) (2026-04-18)


### Bug Fixes

* **core:** destroy body stream on client abort in HttpResponse.write ([eff6e3b](https://github.com/DASPRiD/taxum/commit/eff6e3b7f1a530efb42a5692a8258f9dbdba4754))

## [1.2.2](https://github.com/DASPRiD/taxum/compare/core-v1.2.1...core-v1.2.2) (2026-03-30)


### Bug Fixes

* **core:** rename eror-handler.ts to error-handler.ts ([31fc9fd](https://github.com/DASPRiD/taxum/commit/31fc9fdb232283bd6d332e84381920b02f023692))

## [1.2.1](https://github.com/DASPRiD/taxum/compare/core-v1.2.0...core-v1.2.1) (2026-03-24)


### Bug Fixes

* **core:** use string | undefined for hostname type ([96493f6](https://github.com/DASPRiD/taxum/commit/96493f63a8340f6a27d3100c902ee25641e1bfd1))

## [1.2.0](https://github.com/DASPRiD/taxum/compare/core-v1.1.0...core-v1.2.0) (2026-02-01)


### Features

* **core:** add charset parameter to HTML response header ([023dcaf](https://github.com/DASPRiD/taxum/commit/023dcaf7f9f6e69936e9ddc35cae81b9d8ca699f))

## [1.1.0](https://github.com/DASPRiD/taxum/compare/core-v1.0.4...core-v1.1.0) (2026-01-24)


### Features

* **core:** replace whatwg-mimetypes with native node:utils ([67c6929](https://github.com/DASPRiD/taxum/commit/67c692911c136e210415b22edfe7786c51706dc7))

## [1.0.4](https://github.com/DASPRiD/taxum/compare/core-v1.0.3...core-v1.0.4) (2025-11-13)


### Bug Fixes

* **core:** do not stringify HTML responses as JSON ([66127ff](https://github.com/DASPRiD/taxum/commit/66127ff327f11072a0951e0a28f5d314a5239595))

## [1.0.3](https://github.com/DASPRiD/taxum/compare/core-v1.0.2...core-v1.0.3) (2025-11-06)


### Bug Fixes

* **core:** allow host headers with default ports ([b6953e9](https://github.com/DASPRiD/taxum/commit/b6953e9dfca7083c0766f82e64e1fc532fbc1668))

## [1.0.2](https://github.com/DASPRiD/taxum/compare/core-v1.0.1...core-v1.0.2) (2025-11-05)


### Bug Fixes

* **core:** prevent host injection ([b256e0b](https://github.com/DASPRiD/taxum/commit/b256e0b923ccc5becc09a0f2b34d7e3e2720b3ca))

## [1.0.1](https://github.com/DASPRiD/taxum/compare/core-v1.0.0...core-v1.0.1) (2025-10-11)


### Bug Fixes

* **core:** bump dependencies ([1143735](https://github.com/DASPRiD/taxum/commit/114373520abd8b1087e01b4b261049f34d35e2ef))
* update repository URL casing ([d627606](https://github.com/DASPRiD/taxum/commit/d62760614b6b8d959c78c8ce1efba3f601dbe66d))

## [1.0.0](https://github.com/DASPRiD/taxum/compare/core-v0.16.2...core-v1.0.0) (2025-09-13)


### Miscellaneous Chores

* **core:** release 1.0.0 ([5620f54](https://github.com/DASPRiD/taxum/commit/5620f543b974018abc0203c6da5ff499b366575e))

## [0.16.2](https://github.com/DASPRiD/taxum/compare/core-v0.16.1...core-v0.16.2) (2025-09-12)


### Bug Fixes

* **core:** add missing typehint to ORIGINAL_URI extension ([0b983de](https://github.com/DASPRiD/taxum/commit/0b983decb33d8c3589f86936ed2aad34c951a4b9))

## [0.16.1](https://github.com/DASPRiD/taxum/compare/core-v0.16.0...core-v0.16.1) (2025-09-11)


### Bug Fixes

* **core:** update createExtractHandler typings and remove legacy types ([ff700c8](https://github.com/DASPRiD/taxum/commit/ff700c814bf646933a9ce6a9bdc27c24b39564c4))

## [0.16.0](https://github.com/DASPRiD/taxum/compare/core-v0.15.1...core-v0.16.0) (2025-09-11)


### Features

* replace extractHandler with new createExtractHandler builder ([0835291](https://github.com/DASPRiD/taxum/commit/083529119336088f26097195985ea855147338e5))

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
