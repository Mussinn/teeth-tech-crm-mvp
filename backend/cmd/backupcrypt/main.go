// backupcrypt encrypts backup streams with independently authenticated AES-GCM frames.
package main

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/binary"
	"flag"
	"fmt"
	"io"
	"os"
)

const blockSize = 64 * 1024

func transform(in io.Reader, out io.Writer, key []byte, decrypt bool) error {
	var e error
	header := make([]byte, 36)
	if decrypt {
		if _, e = io.ReadFull(in, header); e != nil {
			return e
		}
		if string(header[:4]) != "TTB1" {
			return fmt.Errorf("invalid backup format")
		}
	} else {
		copy(header, "TTB1")
		if _, e = rand.Read(header[4:]); e != nil {
			return e
		}
		if _, e = out.Write(header); e != nil {
			return e
		}
	}
	derive := hmac.New(sha256.New, key)
	derive.Write(header)
	b, e := aes.NewCipher(derive.Sum(nil))
	if e != nil {
		return e
	}
	g, e := cipher.NewGCM(b)
	if e != nil {
		return e
	}
	nonce := make([]byte, 12)
	size := make([]byte, 4)
	for counter := uint64(0); counter < 1<<32; counter++ {
		binary.BigEndian.PutUint32(nonce[8:], uint32(counter))
		if decrypt {
			if _, e = io.ReadFull(in, size); e != nil {
				return fmt.Errorf("missing authenticated end: %w", e)
			}
			n := binary.BigEndian.Uint32(size)
			if n > blockSize {
				return fmt.Errorf("invalid frame size")
			}
			data := make([]byte, int(n)+g.Overhead())
			if _, e = io.ReadFull(in, data); e != nil {
				return e
			}
			plain, e := g.Open(nil, nonce, data, header)
			if e != nil {
				return fmt.Errorf("wrong key or damaged backup: %w", e)
			}
			if n == 0 {
				var extra [1]byte
				n, e := in.Read(extra[:])
				if n != 0 || e != io.EOF {
					return fmt.Errorf("unexpected trailing data")
				}
				return nil
			}
			if _, e = out.Write(plain); e != nil {
				return e
			}
		} else {
			data := make([]byte, blockSize)
			n, e := io.ReadFull(in, data)
			if e != nil && e != io.EOF && e != io.ErrUnexpectedEOF {
				return e
			}
			binary.BigEndian.PutUint32(size, uint32(n))
			if _, e = out.Write(size); e != nil {
				return e
			}
			sealed := g.Seal(nil, nonce, data[:n], header)
			if _, e = out.Write(sealed); e != nil {
				return e
			}
			if n == 0 {
				return nil
			}
		}
	}
	return fmt.Errorf("backup exceeds frame limit")
}
func run() error {
	mode := flag.String("mode", "encrypt", "keygen, encrypt, decrypt")
	keyPath := flag.String("key", "", "32-byte private key file")
	input := flag.String("in", "-", "input path or - for stdin")
	output := flag.String("out", "", "new output path")
	flag.Parse()
	if *keyPath == "" {
		return fmt.Errorf("key path required")
	}
	if *mode == "keygen" {
		key := make([]byte, 32)
		if _, e := rand.Read(key); e != nil {
			return e
		}
		f, e := os.OpenFile(*keyPath, os.O_WRONLY|os.O_CREATE|os.O_EXCL, 0600)
		if e != nil {
			return e
		}
		defer f.Close()
		_, e = f.Write(key)
		return e
	}
	if (*mode != "encrypt" && *mode != "decrypt") || *output == "" {
		return fmt.Errorf("mode and output required")
	}
	info, e := os.Stat(*keyPath)
	if e != nil {
		return e
	}
	if info.Mode().Perm()&0077 != 0 {
		return fmt.Errorf("key permissions must be 0600")
	}
	key, e := os.ReadFile(*keyPath)
	if e != nil {
		return e
	}
	if len(key) != 32 {
		return fmt.Errorf("key must contain 32 random bytes")
	}
	var in io.Reader = os.Stdin
	if *input != "-" {
		f, e := os.Open(*input)
		if e != nil {
			return e
		}
		defer f.Close()
		in = f
	}
	out, e := os.OpenFile(*output, os.O_WRONLY|os.O_CREATE|os.O_EXCL, 0600)
	if e != nil {
		return e
	}
	success := false
	defer func() {
		out.Close()
		if !success {
			os.Remove(*output)
		}
	}()
	if e = transform(in, out, key, *mode == "decrypt"); e != nil {
		return e
	}
	if e = out.Sync(); e != nil {
		return e
	}
	success = true
	return out.Close()
}
func main() {
	if e := run(); e != nil {
		fmt.Fprintln(os.Stderr, e)
		os.Exit(1)
	}
}
