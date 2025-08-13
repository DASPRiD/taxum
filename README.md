# Taxum

[![Test](https://github.com/DASPRiD/taxum/actions/workflows/test.yml/badge.svg)](https://github.com/DASPRiD/taxum/actions/workflows/test.yml)
[![codecov](https://codecov.io/gh/DASPRiD/taxum/graph/badge.svg?token=fMAHt3CqfR)](https://codecov.io/gh/DASPRiD/taxum)

---

Taxum is a composable and type-safe HTTP framework for Node.js, heavily inspired by Rust's
[Axum](https://github.com/tokio-rs/axum) and [Tower](https://github.com/tower-rs/tower). It brings the same declarative,
middleware-driven architecture to the JavaScript/TypeScript ecosystem, combining ergonomic route composition with deep
integration of the type system.

Written entirely in TypeScript, Taxum focuses on zero-cost abstractions, strong compile-time guarantees, and predictable
request handling. Its design emphasizes modularity and composability, building on principles proven in the Rust
ecosystem and adapting them to the asynchronous, event-driven nature of Node.js.

## Features

- Composable middleware: Tower-style middleware model for building reusable logic layers.
- Type safety first: TypeScript-first design ensures that request parameters, bodies, and responses are all statically
  typed.
- Functional and declarative routing: Build routes as data structures, not strings — inspired by Axum's handler model.
- Performance-aware: Minimal overhead, predictable execution — ideal for high-performance APIs and backend services.
- First-class testing ergonomics: Easy integration with testing tools, request injection, and handler isolation.

## Examples

You can find several examples in the [examples](https://github.com/DASPRiD/taxum/tree/main/packages/examples) folder.

## Documentation

To check out docs, visit [taxum.js.org](https://taxum.js.org).

## License

[BSD-3-Clause](https://github.com/dasprid/taxum/blob/main/LICENSE)

Copyright (c) 2025-present, Ben Scholzen 'DASPRiD
