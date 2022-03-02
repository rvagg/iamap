### [2.0.11](https://github.com/rvagg/iamap/compare/v2.0.10...v2.0.11) (2022-03-02)


### Trivial Changes

* **deps-dev:** bump typescript from 4.5.5 to 4.6.2 ([#37](https://github.com/rvagg/iamap/issues/37)) ([aeae491](https://github.com/rvagg/iamap/commit/aeae49162d02bd631ad7b31de53d3b19fa7d7cd0))
* **no-release:** bump actions/checkout from 2.4.0 to 3 ([#36](https://github.com/rvagg/iamap/issues/36)) ([05c52c7](https://github.com/rvagg/iamap/commit/05c52c7baba29a90316eb16c076dc89485b3c9b0))
* **no-release:** bump actions/setup-node from 2.5.0 to 2.5.1 ([#34](https://github.com/rvagg/iamap/issues/34)) ([db1abb1](https://github.com/rvagg/iamap/commit/db1abb1685f3f7c37ed761b0a6e5e658ce5eae1e))
* **no-release:** bump actions/setup-node from 2.5.1 to 3.0.0 ([#35](https://github.com/rvagg/iamap/issues/35)) ([1599aaa](https://github.com/rvagg/iamap/commit/1599aaa962556237af30cecc8e384a646d3c3e6d))

### [2.0.10](https://github.com/rvagg/iamap/compare/v2.0.9...v2.0.10) (2021-12-14)


### Trivial Changes

* **no-release:** bump actions/setup-node from 2.4.1 to 2.5.0 ([#29](https://github.com/rvagg/iamap/issues/29)) ([88cdd7c](https://github.com/rvagg/iamap/commit/88cdd7ca6d906da8a54a34ff1c28b0b64d42cb51))
* udpate deps, test in webpack5 ([#33](https://github.com/rvagg/iamap/issues/33)) ([7a3bde5](https://github.com/rvagg/iamap/commit/7a3bde5745ce5635507d4b452a8da4f8af1f3cef))

### [2.0.9](https://github.com/rvagg/iamap/compare/v2.0.8...v2.0.9) (2021-11-04)


### Trivial Changes

* **deps:** bump actions/checkout from 2.3.5 to 2.4.0 ([1279157](https://github.com/rvagg/iamap/commit/1279157b9124efc846e721a64213e348d3de1ecf))

### [2.0.8](https://github.com/rvagg/iamap/compare/v2.0.7...v2.0.8) (2021-10-18)


### Trivial Changes

* **deps:** bump actions/checkout from 2.3.4 to 2.3.5 ([990cdc0](https://github.com/rvagg/iamap/commit/990cdc0a0140a894be67c8228ccbcb3764680879))

### [2.0.7](https://github.com/rvagg/iamap/compare/v2.0.6...v2.0.7) (2021-09-28)


### Trivial Changes

* **deps:** bump actions/setup-node from 2.4.0 to 2.4.1 ([28fcb9e](https://github.com/rvagg/iamap/commit/28fcb9e172516375aa8cbe477b8774a8cc96e067))

### [2.0.6](https://github.com/rvagg/iamap/compare/v2.0.5...v2.0.6) (2021-09-16)


### Bug Fixes

* correctly type save() and load() types as async ([da03346](https://github.com/rvagg/iamap/commit/da03346cb419143f81eeead536f82536c8f5580f)), closes [#22](https://github.com/rvagg/iamap/issues/22)

### [2.0.5](https://github.com/rvagg/iamap/compare/v2.0.4...v2.0.5) (2021-08-05)


### Trivial Changes

* **deps:** bump actions/setup-node from 2.3.2 to 2.4.0 ([6a6af26](https://github.com/rvagg/iamap/commit/6a6af26df9e2af157cedb47c4a8492c83fc84f9e))

### [2.0.4](https://github.com/rvagg/iamap/compare/v2.0.3...v2.0.4) (2021-08-05)


### Trivial Changes

* **deps:** bump actions/setup-node from 2.3.1 to 2.3.2 ([f59a212](https://github.com/rvagg/iamap/commit/f59a2125d6de575b51b1c7e2a6673a8646891eb1))

### [2.0.3](https://github.com/rvagg/iamap/compare/v2.0.2...v2.0.3) (2021-08-03)


### Trivial Changes

* **deps:** bump actions/setup-node from 2.3.0 to 2.3.1 ([b1f55f5](https://github.com/rvagg/iamap/commit/b1f55f5f58a81c73e53bc30aa377b459f222a1a2))

### [2.0.2](https://github.com/rvagg/iamap/compare/v2.0.1...v2.0.2) (2021-07-23)


### Trivial Changes

* **deps-dev:** bump @types/mocha from 8.2.3 to 9.0.0 ([2914eed](https://github.com/rvagg/iamap/commit/2914eededad1846e66f6e5feb743b00258708783))

### [2.0.1](https://github.com/rvagg/iamap/compare/v2.0.0...v2.0.1) (2021-07-20)


### Trivial Changes

* **deps:** bump actions/setup-node from 2.1.5 to 2.3.0 ([8501f98](https://github.com/rvagg/iamap/commit/8501f9876f5f1dce18374ff942f8cf9fedc6e5fe))

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
