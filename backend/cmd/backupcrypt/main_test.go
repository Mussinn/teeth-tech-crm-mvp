package main

import (
	"bytes"
	"testing"
)

func TestAuthenticatedBackup(t *testing.T) {
	key := bytes.Repeat([]byte{23}, 32)
	plain := bytes.Repeat([]byte("backup-test"), 20000)
	var encrypted bytes.Buffer
	if e := transform(bytes.NewReader(plain), &encrypted, key, false); e != nil {
		t.Fatal(e)
	}
	var restored bytes.Buffer
	if e := transform(bytes.NewReader(encrypted.Bytes()), &restored, key, true); e != nil {
		t.Fatal(e)
	}
	if !bytes.Equal(restored.Bytes(), plain) {
		t.Fatal("roundtrip mismatch")
	}
	for _, variant := range []string{"wrong-key", "truncated", "modified", "extra"} {
		t.Run(variant, func(t *testing.T) {
			data := append([]byte{}, encrypted.Bytes()...)
			k := append([]byte{}, key...)
			switch variant {
			case "wrong-key":
				k[0] ^= 1
			case "truncated":
				data = data[:len(data)-20]
			case "modified":
				data[40] ^= 1
			case "extra":
				data = append(data, 1)
			}
			var out bytes.Buffer
			if transform(bytes.NewReader(data), &out, k, true) == nil {
				t.Fatal("invalid backup accepted")
			}
		})
	}
}
