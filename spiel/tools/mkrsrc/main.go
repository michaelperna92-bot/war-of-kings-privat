// Erzeugt eine COFF-Ressourcendatei (.syso) mit Icon-Gruppe und Manifest für den Go-Linker.
package main

import (
	"bytes"
	"encoding/binary"
	"os"
	"sort"
	"unicode/utf16"
)

type res struct {
	typ, id uint32
	data    []byte
}

func le(b *bytes.Buffer, v ...any) {
	for _, x := range v {
		binary.Write(b, binary.LittleEndian, x)
	}
}

func main() {
	ico, _ := os.ReadFile(os.Args[1])
	man, _ := os.ReadFile(os.Args[2])
	n := int(binary.LittleEndian.Uint16(ico[4:]))
	var rs []res
	var grp bytes.Buffer
	le(&grp, uint16(0), uint16(1), uint16(n))
	for i := 0; i < n; i++ {
		e := ico[6+16*i:]
		size := binary.LittleEndian.Uint32(e[8:])
		off := binary.LittleEndian.Uint32(e[12:])
		rs = append(rs, res{3, uint32(i + 1), ico[off : off+size]})
		grp.Write(e[:8])
		le(&grp, size, uint16(i+1))
	}
	rs = append(rs, res{14, 1, grp.Bytes()}, res{24, 1, man}, res{16, 1, versionInfo()})
	sort.SliceStable(rs, func(a, b int) bool { return rs[a].typ < rs[b].typ })

	// Typen gruppieren
	types := []uint32{}
	byType := map[uint32][]res{}
	for _, r := range rs {
		if _, ok := byType[r.typ]; !ok {
			types = append(types, r.typ)
		}
		byType[r.typ] = append(byType[r.typ], r)
	}
	dirSize := func(k int) int { return 16 + 8*k }
	// Layout: Wurzel, Namensverzeichnisse, Sprachverzeichnisse, Dateneinträge, Daten
	off := dirSize(len(types))
	nameOff := map[uint32]int{}
	for _, t := range types {
		nameOff[t] = off
		off += dirSize(len(byType[t]))
	}
	langOff := make([]int, len(rs))
	idx := 0
	order := []res{}
	for _, t := range types {
		for _, r := range byType[t] {
			langOff[idx] = off
			off += dirSize(1)
			order = append(order, r)
			idx++
		}
	}
	entryOff := make([]int, len(order))
	for i := range order {
		entryOff[i] = off
		off += 16
	}
	dataOff := make([]int, len(order))
	for i, r := range order {
		for off%8 != 0 {
			off++
		}
		dataOff[i] = off
		off += len(r.data)
	}
	var s bytes.Buffer
	hdr := func(k int) { le(&s, uint32(0), uint32(0), uint16(0), uint16(0), uint16(0), uint16(k)) }
	hdr(len(types))
	for _, t := range types {
		le(&s, t, uint32(nameOff[t])|0x80000000)
	}
	i := 0
	for _, t := range types {
		hdr(len(byType[t]))
		for _, r := range byType[t] {
			le(&s, r.id, uint32(langOff[i])|0x80000000)
			i++
		}
	}
	for i := range order {
		hdr(1)
		le(&s, uint32(0x0407), uint32(entryOff[i]))
	}
	var relocs []uint32
	for i, r := range order {
		relocs = append(relocs, uint32(s.Len()))
		le(&s, uint32(dataOff[i]), uint32(len(r.data)), uint32(0), uint32(0))
	}
	for i, r := range order {
		for s.Len() < dataOff[i] {
			s.WriteByte(0)
		}
		s.Write(r.data)
	}
	for s.Len()%4 != 0 {
		s.WriteByte(0)
	}
	raw := s.Bytes()
	var o bytes.Buffer
	rawPtr := uint32(20 + 40)
	relPtr := rawPtr + uint32(len(raw))
	symPtr := relPtr + uint32(10*len(relocs))
	le(&o, uint16(0x8664), uint16(1), uint32(0), symPtr, uint32(1), uint16(0), uint16(0))
	o.WriteString(".rsrc\x00\x00\x00")
	le(&o, uint32(0), uint32(0), uint32(len(raw)), rawPtr, relPtr, uint32(0), uint16(len(relocs)), uint16(0), uint32(0x40000040))
	o.Write(raw)
	for _, r := range relocs {
		le(&o, r, uint32(0), uint16(3)) // IMAGE_REL_AMD64_ADDR32NB auf Symbol 0 (.rsrc)
	}
	o.WriteString(".rsrc\x00\x00\x00")
	le(&o, uint32(0), uint16(1), uint16(0), uint8(3), uint8(0))
	le(&o, uint32(4))
	os.WriteFile(os.Args[3], o.Bytes(), 0o644)
}

// ---------- VS_VERSIONINFO (Programmangaben in den Dateieigenschaften) ----------
func u16z(str string) []byte {
	var b bytes.Buffer
	for _, c := range utf16.Encode([]rune(str)) {
		le(&b, c)
	}
	le(&b, uint16(0))
	return b.Bytes()
}
func pad4(b *bytes.Buffer) {
	for b.Len()%4 != 0 {
		b.WriteByte(0)
	}
}

// block: wLength, wValueLength, wType, szKey, Padding, Value, Padding, Children
func vblock(key string, value []byte, valueLen uint16, typ uint16, children ...[]byte) []byte {
	var b bytes.Buffer
	le(&b, uint16(0), valueLen, typ)
	b.Write(u16z(key))
	pad4(&b)
	b.Write(value)
	for _, c := range children {
		pad4(&b)
		b.Write(c)
	}
	out := b.Bytes()
	binary.LittleEndian.PutUint16(out[0:], uint16(len(out)))
	return out
}
func vstring(k, v string) []byte {
	val := u16z(v)
	return vblock(k, val, uint16(len(val)/2), 1)
}
func versionInfo() []byte {
	ver := os.Getenv("WOK_VERSION")
	if ver == "" {
		ver = "7.8.0.0"
	}
	var nums [4]uint16
	n := 0
	cur := 0
	for _, c := range ver + "." {
		if c == '.' {
			if n < 4 {
				nums[n] = uint16(cur)
			}
			n++
			cur = 0
		} else {
			cur = cur*10 + int(c-'0')
		}
	}
	var ff bytes.Buffer
	le(&ff, uint32(0xFEEF04BD), uint32(0x00010000),
		uint32(nums[0])<<16|uint32(nums[1]), uint32(nums[2])<<16|uint32(nums[3]),
		uint32(nums[0])<<16|uint32(nums[1]), uint32(nums[2])<<16|uint32(nums[3]),
		uint32(0x3F), uint32(0), uint32(0x00040004), uint32(1), uint32(0), uint32(0), uint32(0))
	strs := [][]byte{
		vstring("CompanyName", "War of Kings"),
		vstring("FileDescription", "War of Kings Probe-Spiel – Installation und Programm"),
		vstring("FileVersion", ver),
		vstring("InternalName", "WoK-Probe-Spiel"),
		vstring("LegalCopyright", "© 2026 War of Kings"),
		vstring("OriginalFilename", "WoK-Probe-Spiel-Setup.exe"),
		vstring("ProductName", "War of Kings Probe-Spiel"),
		vstring("ProductVersion", ver),
	}
	table := vblock("040704b0", nil, 0, 1, strs...)
	sfi := vblock("StringFileInfo", nil, 0, 1, table)
	var tr bytes.Buffer
	le(&tr, uint16(0x0407), uint16(0x04b0))
	vfi := vblock("VarFileInfo", nil, 0, 1, vblock("Translation", tr.Bytes(), 4, 0))
	return vblock("VS_VERSION_INFO", ff.Bytes(), 52, 0, sfi, vfi)
}
