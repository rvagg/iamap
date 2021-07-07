## [2.0.0](https://github.com/rvagg/iamap/compare/v1.0.0...v2.0.0) (2021-07-07)


### ⚠ BREAKING CHANGES

* migrate serialized form to match IPLD HashMap spec
* remove block-by-block traversals
* use integer multicodec codes for `hashAlg`

### Features

* add type definitions and build:types script ([fa75267](https://github.com/rvagg/iamap/commit/fa75267533077b22aecf595597ceda7dd864c609))
* allow asynchronous hasher function ([58d58ed](https://github.com/rvagg/iamap/commit/58d58edb2f9588ca21d025f2927f3fc6fe091dc9))
* migrate serialized form to match IPLD HashMap spec ([a8002b0](https://github.com/rvagg/iamap/commit/a8002b0ae95758993897ef3d78cb59e72221a7ff))
* remove block-by-block traversals ([ddc1227](https://github.com/rvagg/iamap/commit/ddc1227225a33a015cdc0bcdb8ca363ca6b5eb9b))
* use integer multicodec codes for `hashAlg` ([5140627](https://github.com/rvagg/iamap/commit/51406275bdeacccc900b2aae59f79bb6818df24d))


### Bug Fixes

* **doc:** clean up docs for README autogen ([813a853](https://github.com/rvagg/iamap/commit/813a853016ad6355ed19763ee5376a14514a38ed))
* broken byteCompare ([8f26675](https://github.com/rvagg/iamap/commit/8f266750f41e87d54933721f5c79eb0f20466041))
* coverage ignores for stricter type guards ([7e3fa6a](https://github.com/rvagg/iamap/commit/7e3fa6a3fd05330f3c7d7f87b13caaf9c9002a51))
* update and fix examples ([daef015](https://github.com/rvagg/iamap/commit/daef015533314246a8cfa658dc49718900404c08))


### Trivial Changes

* **perf:** cache hash of key ([f7c3d05](https://github.com/rvagg/iamap/commit/f7c3d05af2c43912e368b76b0ef073146de813fa))
* add github actions - dependabot / test / semantic-release ([fb382a5](https://github.com/rvagg/iamap/commit/fb382a5de23108fa3b916b669b3f73868412aeda))
* add typechecking to tests ([fbefbfd](https://github.com/rvagg/iamap/commit/fbefbfdf65f615231d9558572a733c1300ce3b7b))
