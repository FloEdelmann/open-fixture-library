# DMXControl3 plugin

<http://www.dmxcontrol.de/>

Free lighting software, especially common in Germany, developed and distributed by the non-profit association DMXControl Projects e.V. Works only on Windows.

This plugin handles *Device Definition Files* (*DDF*) of version 3, used in DMXControl 3. They are saved as xml files (one file per mode) and can be created with the DDFCreator program.

### File locations

Fixtures are always located in the `<install-dir>\Kernel\Devices\` directory. The installation directory usually is `C:\Program Files\DMXControl3`. Definition files may be stored in subfolders, but the filenames still need to be unique (`Devices\manA\fix123.xml` and `Devices\manB\fix123.xml` doesn't work). Note that the DDFCreator doesn't recognize subfolders.

### Documentation

- [Tutorial on how to create a device definition](https://wiki.dmxcontrol.de/wiki/Lektion_20_Tut3) *(german)*
- [Device definition specification](https://wiki.dmxcontrol.de/wiki/DDF_DMXC3) *(german)*