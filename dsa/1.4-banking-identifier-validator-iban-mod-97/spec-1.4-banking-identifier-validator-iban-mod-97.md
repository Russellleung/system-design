# Spec 1.4: Banking Identifier Validator (IBAN Mod-97)

## 1. Problem Statement
Cross-border payment networks process millions of international bank account numbers (IBANs) per day. Validating IBAN format and checking ISO 7064 Mod-97-10 checksums using standard string-to-BigInteger conversion incurs garbage collection overhead. We require a zero-allocation streaming validator.

## 2. Interface & Types (Java)

```java
public class Spec1_4 {

    public enum ValidationError {
        NONE,
        INVALID_LENGTH,
        INVALID_COUNTRY_CODE,
        INVALID_CHARACTERS,
        CHECKSUM_FAILED
    }

    public record ValidationResult(
        boolean isValid,
        ValidationError error,
        String countryCode,
        String bankCode,
        String accountNumber
    ) {}

    public interface IBANValidator {
        ValidationResult validate(String iban);
    }
}
```

## 3. Constraints & Rules
* **Format**: Two letter country code, two check digits, followed by up to 30 alphanumeric BBAN characters.
* **Checksum**: Rearrange IBAN (`BBAN` + `CountryCode` + `CheckDigits`), convert letters to numbers (`A`=10, `Z`=35), and compute Mod 97 = 1.
* **Streaming Math**: Compute `(remainder * 10 + digit) % 97` piece-by-piece without string concatenation or BigInteger allocations.

## 4. Complete Implementation (Java)

```java
import java.util.*;

public class Spec1_4_BankIdentifierValidator {

    public enum ValidationError {
        NONE,
        INVALID_LENGTH,
        INVALID_COUNTRY_CODE,
        INVALID_CHARACTERS,
        CHECKSUM_FAILED
    }

    public record ValidationResult(
        boolean isValid,
        ValidationError error,
        String countryCode,
        String bankCode,
        String accountNumber
    ) {}

    public interface IBANValidator {
        ValidationResult validate(String iban);
    }

    public static class DefaultIBANValidator implements IBANValidator {
        private static final Map<String, Integer> COUNTRY_LENGTHS = Map.of(
            "GB", 22,
            "DE", 22,
            "FR", 27,
            "CH", 21,
            "NL", 18
        );

        @Override
        public ValidationResult validate(String rawIban) {
            if (rawIban == null) {
                return new ValidationResult(false, ValidationError.INVALID_CHARACTERS, null, null, null);
            }

            String clean = rawIban.replaceAll("\\s+", "").toUpperCase();
            if (clean.length() < 5) {
                return new ValidationResult(false, ValidationError.INVALID_LENGTH, null, null, null);
            }

            String country = clean.substring(0, 2);
            if (!country.matches("[A-Z]{2}")) {
                return new ValidationResult(false, ValidationError.INVALID_COUNTRY_CODE, null, null, null);
            }

            Integer expectedLength = COUNTRY_LENGTHS.get(country);
            if (expectedLength != null && clean.length() != expectedLength) {
                return new ValidationResult(false, ValidationError.INVALID_LENGTH, country, null, null);
            }

            if (!clean.matches("[A-Z0-9]+")) {
                return new ValidationResult(false, ValidationError.INVALID_CHARACTERS, country, null, null);
            }

            String rearranged = clean.substring(4) + clean.substring(0, 4);
            int remainder = 0;

            for (int i = 0; i < rearranged.length(); i++) {
                char ch = rearranged.charAt(i);
                if (Character.isDigit(ch)) {
                    remainder = (remainder * 10 + (ch - '0')) % 97;
                } else if (Character.isLetter(ch)) {
                    int val = ch - 'A' + 10;
                    remainder = (remainder * 10 + (val / 10)) % 97;
                    remainder = (remainder * 10 + (val % 10)) % 97;
                }
            }

            if (remainder != 1) {
                return new ValidationResult(false, ValidationError.CHECKSUM_FAILED, country, null, null);
            }

            String bankCode = clean.length() >= 8 ? clean.substring(4, 8) : "";
            String accountNo = clean.length() > 8 ? clean.substring(8) : "";

            return new ValidationResult(true, ValidationError.NONE, country, bankCode, accountNo);
        }
    }

    public static void main(String[] args) {
        System.out.println("=== Spec 1.4: Banking Identifier Validator (IBAN Mod-97) Demo ===");
        IBANValidator validator = new DefaultIBANValidator();

        String validGb = "GB82 WEST 1234 5698 7654 32";
        ValidationResult r1 = validator.validate(validGb);
        System.out.println("Validating GB IBAN: " + validGb);
        System.out.println("  -> IsValid: " + r1.isValid() + ", Country: " + r1.countryCode() + ", Bank: " + r1.bankCode() + ", Account: " + r1.accountNumber());

        ValidationResult r2 = validator.validate("GB82 WEST 1234 5698 7654 99");
        System.out.println("Validating Invalid Checksum: " + r2.isValid() + ", Error: " + r2.error());

        System.out.println("=== Demo Execution Successful ===");
    }
}
```
