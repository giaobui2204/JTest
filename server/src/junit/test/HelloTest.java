
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;
public class HelloTest {
@Test
    void testMessage() {
        assertEquals("Hello JTest!", Main.getMessage());
}
@Test
void testAdd() {
        assertEquals(5, Main.add(2, 3));
        assertNotEquals(6, Main.add(2, 3));
}
}
