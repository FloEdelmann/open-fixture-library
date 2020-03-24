# Open Fixture Library – <a href="https://open-fixture-library.org/">open-fixture-library.org</a>

[![GitHub Actions Status](https://github.com/OpenLightingProject/open-fixture-library/workflows/Test/badge.svg)](https://github.com/OpenLightingProject/open-fixture-library/actions)
[![Travis Status](https://img.shields.io/travis/OpenLightingProject/open-fixture-library/master.svg?label=Travis&logo=travis-ci&logoColor=white)](https://travis-ci.org/OpenLightingProject/open-fixture-library/branches)
[![Code Quality](https://api.codacy.com/project/badge/Grade/73096865e9f44a7bb246a318ffc8e68b)](https://www.codacy.com/app/FloEdelmann/open-fixture-library)
[![David Dependency Manager](https://img.shields.io/david/OpenLightingProject/open-fixture-library.svg)](https://david-dm.org/OpenLightingProject/open-fixture-library)
[![Known Vulnerabilities](https://snyk.io/test/github/FloEdelmann/open-fixture-library/badge.svg)](https://snyk.io/test/github/FloEdelmann/open-fixture-library)

[<img alt="OFL logo" src="https://cdn.rawgit.com/OpenLightingProject/open-fixture-library/master/ui/static/ofl-logo.svg" width="250" />](ui/static/ofl-logo.svg)

To use lighting control software like [QLC+](https://www.qlcplus.org/), [DMXControl](https://www.dmxcontrol.org/) or [e:cue](https://www.osram.de/ecue/), you need fixture definition files that describe your lighting hardware. Since one software can usually only understand its own fixture definition format, switching between different programs can be difficult.

The *Open Fixture Library* tries to solve this problem by collecting fixture definitions and making them downloadable in various formats. Internally, it uses a [JSON format](docs/fixture-format.md) that tries to bundle as much information as possible for all the different output formats.


## Contribute

If you are a **user** and want to help, head over to the [Fixture Editor](https://open-fixture-library.org/fixture-editor) and add your favorite fixture that is not yet included in our library!

If you are a **developer**, see [CONTRIBUTING.md](docs/CONTRIBUTING.md) and our [Developer Documentation](docs/README.md).
