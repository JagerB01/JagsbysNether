"""Losslessly read/write little-endian Bedrock NBT and remove structure wart."""
import io
import struct


class NBT:
    def __init__(self, data=b''):
        self.stream = io.BytesIO(data)

    def read(self, fmt):
        size = struct.calcsize('<' + fmt)
        return struct.unpack('<' + fmt, self.stream.read(size))[0]

    def string(self):
        return self.stream.read(self.read('H')).decode('utf-8')

    def payload(self, kind):
        if kind in range(1, 7):
            return self.read({1:'b', 2:'h', 3:'i', 4:'q', 5:'f', 6:'d'}[kind])
        if kind == 7:
            return self.stream.read(self.read('i'))
        if kind == 8:
            return self.string()
        if kind == 9:
            child, count = self.read('B'), self.read('i')
            return child, [self.payload(child) for _ in range(count)]
        if kind == 10:
            entries = {}
            while (child := self.read('B')):
                name = self.string()
                entries[name] = (child, self.payload(child))
            return entries
        if kind in (11, 12):
            return [self.read('i' if kind == 11 else 'q') for _ in range(self.read('i'))]
        raise ValueError(f'Unsupported NBT tag {kind}')

    def write(self, fmt, value):
        self.stream.write(struct.pack('<' + fmt, value))

    def put_string(self, value):
        data = value.encode('utf-8')
        self.write('H', len(data))
        self.stream.write(data)

    def put(self, kind, value):
        if kind in range(1, 7):
            self.write({1:'b', 2:'h', 3:'i', 4:'q', 5:'f', 6:'d'}[kind], value)
        elif kind == 7:
            self.write('i', len(value))
            self.stream.write(value)
        elif kind == 8:
            self.put_string(value)
        elif kind == 9:
            child, entries = value
            self.write('B', child)
            self.write('i', len(entries))
            for entry in entries:
                self.put(child, entry)
        elif kind == 10:
            for name, (child, entry) in value.items():
                self.write('B', child)
                self.put_string(name)
                self.put(child, entry)
            self.write('B', 0)
        elif kind in (11, 12):
            self.write('i', len(value))
            for entry in value:
                self.write('i' if kind == 11 else 'q', entry)
        else:
            raise ValueError(f'Unsupported NBT tag {kind}')


def strip_wart(data):
    reader = NBT(data)
    kind, name = reader.read('B'), reader.string()
    assert kind == 10, 'Structure root must be a compound'
    root = reader.payload(kind)
    assert reader.stream.read() == b'', 'Trailing structure data'
    writer = NBT()
    writer.write('B', kind)
    writer.put_string(name)
    writer.put(kind, root)
    assert writer.stream.getvalue() == data, 'NBT round-trip changed source bytes'
    size = root['size'][1][1]
    structure = root['structure'][1]
    palette = structure['palette'][1]['default'][1]['block_palette'][1][1]
    wart = {i for i, block in enumerate(palette) if block['name'][1] == 'minecraft:nether_wart'}
    positions = set()
    for _, indices in structure['block_indices'][1][1]:
        for index, palette_index in enumerate(indices):
            if palette_index in wart:
                x, remainder = divmod(index, size[1] * size[2])
                y, z = divmod(remainder, size[2])
                positions.add((x, y, z))
    if not wart:
        return data, []
    for index in wart:
        palette[index]['name'] = (8, 'minecraft:air')
        palette[index]['states'] = (10, {})
    writer = NBT()
    writer.write('B', kind)
    writer.put_string(name)
    writer.put(kind, root)
    output = writer.stream.getvalue()
    assert all(block['name'][1] != 'minecraft:nether_wart' for block in palette)
    return output, sorted(positions)
