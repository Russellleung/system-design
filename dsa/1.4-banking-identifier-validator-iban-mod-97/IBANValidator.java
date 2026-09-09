import java.util.*;

public class IBANValidator {

    public enum ValidationError {
        NONE, INVALID_LENGTH, INVALID_COUNTRY_CODE, INVALID_CHARACTERS, CHECKSUM_FAILED
    }

    public record ValidationResult(boolean isValid, ValidationError error, String countryCode, String bankCode,
            String accountNumber) {
    }

    private static final Map<String, Integer> COUNTRY_LENGTHS = Map.of(
            "GB", 22, "DE", 22, "FR", 27, "CH", 21, "NL", 18);

    public ValidationResult validate(String rawIban) {
        if (rawIban == null)
            return new ValidationResult(false, ValidationError.INVALID_CHARACTERS, null, null, null);

        String clean = rawIban.replaceAll("\\s+", "").toUpperCase();
        if (clean.length() < 5)
            return new ValidationResult(false, ValidationError.INVALID_LENGTH, null, null, null);

        String country = clean.substring(0, 2);
        if (!country.matches("[A-Z]{2}"))
            return new ValidationResult(false, ValidationError.INVALID_COUNTRY_CODE, null, null, null);

        Integer expectedLength = COUNTRY_LENGTHS.get(country);
        if (expectedLength != null && clean.length() != expectedLength) {
            return new ValidationResult(false, ValidationError.INVALID_LENGTH, country, null, null);
        }

        if (!clean.matches("[A-Z0-9]+"))
            return new ValidationResult(false, ValidationError.INVALID_CHARACTERS, country, null, null);

        String rearranged = clean.substring(4) + clean.substring(0, 4);
        System.out.println(rearranged);
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

        if (remainder != 1)
            return new ValidationResult(false, ValidationError.CHECKSUM_FAILED, country, null, null);

        String bankCode = clean.length() >= 8 ? clean.substring(4, 8) : "";
        String accountNo = clean.length() > 8 ? clean.substring(8) : "";

        return new ValidationResult(true, ValidationError.NONE, country, bankCode, accountNo);
    }

    public static void main(String[] args) {
        System.out.println("=== Spec 1.4: Banking Identifier Validator (IBAN Mod-97) Demo ===");
        IBANValidator validator = new IBANValidator();

        String validGb = "GB82 WEST 1234 5698 7654 32";
        ValidationResult r1 = validator.validate(validGb);
        System.out.println("Validating GB IBAN: " + validGb);
        System.out.println("  -> IsValid: " + r1.isValid() + ", Country: " + r1.countryCode() + ", Bank: "
                + r1.bankCode() + ", Account: " + r1.accountNumber());

        ValidationResult r2 = validator.validate("GB82 WEST 1234 5698 7654 99");
        System.out.println("Validating Invalid Checksum: " + r2.isValid() + ", Error: " + r2.error());
        System.out.println("=== Demo Execution Successful ===");
    }
}
